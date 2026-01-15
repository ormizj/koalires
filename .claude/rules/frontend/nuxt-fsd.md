# template-nuxt-fsd

A nuxt.js - V4 template, using [Feature-Sliced Design](https://feature-sliced.design/) architecture

## Key Concepts

- Import - **Layers** and **Slices** may only import from layers below them _(see: Layer Hierarchy)_. <br>
  **Segments**, however, are allowed to import from their siblings _(see: Segments)_.

- Export - Exports to external modules should be from a **public API**, which serves as a contract between a group of
  modules (files), and the code that uses it. <br>
  It also acts as a gate, only allowing access to certain objects, and only through that public API _(see: Public API)_.

- Nesting - Most **Layers** should be limited to **3 levels of nesting** _(Layer > Slice > Segment)_. <br>
  The **App** and **Shared** layers can exceed this limit due to their unique rules _(see: Levels)_.

- Navigation - When creating new **segments** is that segment names should describe **purpose (the "why")**, not essence
  **(the "what")**. Avoid like “components”, “hooks”, “modals”, since they describe what these files
  are, but don’t help to navigate the code inside _(see: Levels)_

---

## Levels

There are 3 nesting levels in the application:

1. **Layer**
   - **standard:** app, pages, widgets, features, entities, shared
2. **Slices**
   - **custom:** photo, effects, gallery-page, post, comments, news-feed etc...
3. **Segments**
   - **standard:** ui, api, model, lib, config
   - **custom:** compose, like, delete, etc...

> ### [Layers](https://feature-sliced.design/docs/reference/layers)

Layers are the **FIRST** level of organisational hierarchy in Feature-Sliced Design. Their purpose is to separate code
based
on how much responsibility it needs and how many other modules in the app it depends on. Every layer carries special
semantic meaning to help you determine how much responsibility you should allocate to your code.

There are 6 layers in total, arranged from most responsibility and dependency to least:

A file system tree, with a single root folder called src and then seven subfolders: app, pages, widgets,
features, entities, shared.

#### [Layer Hierarchy](https://feature-sliced.design/docs/get-started/overview#concepts):

_modules on one layer can only know about and import from modules from the layers strictly below._

1. **_App_\*** - everything that makes the app run — routing, entrypoints, global styles, providers.
2. **Pages** - full pages or large parts of a page in nested routing.
3. **Widgets** - large **self-contained** chunks of functionality or UI, usually delivering an entire use case.
4. **Features** - reused implementations of entire product features, i.e. **actions** that bring business value to the
   user.
5. **Entities** - business entities that the project works with, like `user` or `product`.
6. **_Shared_\*** - reusable functionality, especially when it's detached from the specifics of the project/business,
   though not necessarily.

\*_App & Shared: Layers App and Shared, unlike other layers, do not have slices and are divided into segments directly._

\*_The most common places for custom segments are the App layer and the Shared layer, where slices don't make sense._

#### 1. [App](https://feature-sliced.design/docs/reference/layers#app)

All kinds of app-wide matters, both in the technical sense (e.g., context providers) and in the business sense (e.g.,
analytics).This layer usually doesn't contain slices, as well as Shared, instead having segments directly.

#### 2. [Pages](https://feature-sliced.design/docs/reference/layers#pages)

Pages are what makes up websites and applications (also known as screens or activities). One page usually corresponds to
one slice, however, if there are several very similar pages, they can be grouped into one slice, for example,
registration and login forms.

#### 3. [Widgets](https://feature-sliced.design/docs/reference/layers#widgets)

The Widgets layer is intended for large self-sufficient blocks of UI. Widgets are most useful when they are reused
across multiple pages, or when the page that they belong to has multiple large independent blocks, and this is one of
them.

#### 4. [Features](https://feature-sliced.design/docs/reference/layers#features)

This layer is for the main interactions in your app, things that your users care to do. These interactions often involve
business entities, because that's what the app is about.

- There can be no "map-office" feature
  - But `booking-meeting-on-the-map`, `search-for-an-employee`, `change-of-workplace` - yes

#### 5. [Entities](https://feature-sliced.design/docs/reference/layers#entities)

Slices on this layer represent concepts from the real world that the project is working with. Commonly, they are the
terms that the business uses to describe the product. For example, a social network might work with business entities
like User, Post, and Group.

#### 6. [Shared](https://feature-sliced.design/docs/reference/layers#shared)

This layer forms a foundation for the rest of the app. It's a place to create connections with the external world, for
example, backends, third-party libraries, the environment. It is also a place to define your own highly contained
libraries.

> ### [Slices](https://feature-sliced.design/docs/reference/slices-segments#slices)

Slices are the **SECOND** level in the organizational hierarchy of Feature-Sliced Design. Their main purpose is to group
code by its meaning for the product, business, or just the application, they are meant to be independent and highly
cohesive groups of code files.

The names of slices are not standardized because they are directly determined by the business domain of your
application. For example, a photo gallery might have slices photo, effects, gallery-page. A social network would require
different slices, for example, post, comments, news-feed.

The layers Shared and App don't contain slices. That is because Shared should contain no business logic at all, hence
has no meaning for the product, and App should contain only code that concerns the entire application, so no splitting
is necessary.

> ### [Segments](https://feature-sliced.design/docs/reference/slices-segments#segments)

Segments are the third and **FINAL** level in the organizational hierarchy, and their purpose is to group code by its
technical nature.

Unlike slices, where imports between siblings are restricted, segments within the same slice are allowed to import
from their siblings.
This flexibility exists because segments are not business units but technical subdivisions of a slice, and they often
need to cooperate closely.

There a few standardized segment names:

- ui — everything related to UI display: UI components, date formatters, styles, etc.
- api — backend interactions: request functions, data types, mappers, etc.
- model — the data model: schemas, interfaces, stores, and business logic.
- lib — library code that other modules on this slice need.
- config — configuration files and feature flags.

---

## [Public API](https://feature-sliced.design/docs/reference/public-api) ("index.ts")

A public API is a contract between a group of modules, like a slice, and the code that uses it. It also acts as a gate,
only allowing access to certain objects, and only through that public API.

In practice, it's usually implemented as an **index** file with re-exports:

> `pages/auth/index.ts`
>
> ```ts
> export { LoginPage } from './ui/LoginPage';
> export { RegisterPage } from './ui/RegisterPage';
> ```

A good public API makes using and integrating into other code a slice convenient and reliable. It can be achieved by
setting these three goals:

1. The rest of the application must be protected from structural changes to the slice, like a refactoring
2. Significant changes in the behavior of the slice that break the previous expectations should cause changes in the
   public API
3. Only the necessary parts of the slice should be exposed

Imports should be done by:

- When they are in the same slice, always use **relative imports** and write the full import path (e.g. `../lib/data`)
- When they are in different slices, always use **absolute imports**, for example, with an alias (
  e.g. `@/shared/lib/data`)

#### App and Shared

Public APIs in App and Shared should avoid exposing too many exports at once.
Otherwise, they may inherit the same drawbacks as
[Barrel Files](https://tkdodo.eu/blog/please-stop-using-barrel-files)
(e.g., slower development, unclear dependencies).

And if a single public API in App or Shared (e.g. `shared/ui` or `shared/lib`) starts causing large or unwanted bundles,
prefer creating a dedicated index file for each component or library instead:

- `shared/ui/`
  - `button`
    - `index.js`
  - `text-field`
    - `index.js`

### [Public API for cross-imports](https://feature-sliced.design/docs/reference/public-api#public-api-for-cross-imports)

Cross-imports are a situation when one slice imports from another slice on the same layer. Usually that
is prohibited by
the [import rule on layers](https://feature-sliced.design/docs/reference/layers#import-rule-on-layers), but often there
are legitimate reasons to cross-import. For example, business entities
often
reference each other in the real world, and it's best to reflect these relationships in the code instead of working
around them.

For this purpose, there's a special kind of public API, also known as the @x-notation. If you have entities A and B, and
entity B needs to import from entity A, then entity A can declare a separate public API just for entity B.

- 📂 `entities`
  - 📂 `A`
    - 📂 `@x`
      - 📄 `B.ts` — a special public API just for code inside entities/B/
    - 📄 `index.ts` — the regular public API

Then the code inside `entities/B/` can import from `entities/A/@x/B`:

```ts
import type { EntityA } from 'entities/A/@x/B';
```

The notation `A/@x/B` is meant to be read as "A crossed with B".

---

## Further Notes

### App

- In the App layer, segments (like `routes`, `store`, `entrypoint`, etc.) may import from their siblings directly (not
  using their public APIs); you shouldn’t use the `@x` notation.
- App doesn't contain slices, App should contain only code that concerns the **entire application**, so no splitting is
  necessary.
- Since slices don't exist in the App, **all files in App can reference and import from each other.**

### Shared

- In the Shared layer, segments (like `api`, `ui`, `lib`, etc.) may import from their siblings directly (not using their
  public APIs); you shouldn’t use the `@x` notation.
- For the Shared layer that has no slices, it’s usually more convenient to define a **separate public API for each
  segment**
  as opposed to defining one single index of everything in Shared.
- Shared is different from other layers in the sense that it **contains segments, not slices.** In this way, the Shared
  layer can be thought of as a hybrid between a layer and a slice.
- Slices are intended to divide the layer into business domains, but business domains do not exist in Shared. This means
  that **all files in Shared can reference and import from each other.**
- Shared doesn't contain slices. That is because Shared should contain **no business** logic at all, hence has no
  meaning for the product.

### [Types](https://feature-sliced.design/docs/guides/examples/types)

#### [Utility Types](https://feature-sliced.design/docs/guides/examples/types#utility-types)

Utility types are types that don't have much meaning on their own and are usually used with other types. For example:

```ts
type ArrayValues<T extends readonly unknown[]> = T[number];
```

To make utility types available across your project, either install a library like type-fest, or create your own library
in `shared/lib`. Make sure to clearly indicate what new types should be added to this library, and what types don't
belong
there. For example, call it `shared/lib/utility-types` and add a README inside that describes what is a utility type in
your team.

Don't overestimate the potential reusability of a utility type. Just because it can be reused, doesn't mean it will be,
and as such, not every utility type needs to be in Shared. Some utility types are fine right next to where they are
needed:

- 📂 pages
  - 📂 home
    - 📂 api
      - 📄 ArrayValues.ts (utility type)
      - 📄 getMemoryUsageMetrics.ts (the code that uses the utility type)

#### [Ambient declaration files (\*.d.ts)](https://feature-sliced.design/docs/guides/examples/types#ambient-declaration-files-dts)

Some packages, for example, [Vite](https://vitejs.dev/) or [ts-reset](https://www.totaltypescript.com/ts-reset), require
ambient declaration files to work
across your app. Usually,
they
aren't large or complicated, so they often don't require any architecting, it's fine to just throw them in the `src/`
folder. To keep the `src` more organized, you can keep them on the App layer, in `app/ambient/`.

Other packages simply don't have typings, and you might want to declare them as untyped or even write your own typings
for them. A good place for those typings would be `shared/lib`, in a folder like `shared/lib/untyped-packages`. Create a
`%LIBRARY_NAME%.d.ts` file there and declare the types you need:

> `shared/lib/untyped-packages/use-react-screenshot.d.ts`
>
> ```ts
> // This library doesn't have typings, and we didn't want to bother writing our own.
> declare module 'use-react-screenshot';
> ```

### [Naming Conflicts](https://feature-sliced.design/docs/about/understanding/naming#when-can-naming-interfere)

Naming conflicts can occur when terms used in the FSD methodology overlap with terms used in the business:

- `FSD#process` vs simulated process in an application,
- `FSD#page` vs log page,
- `FSD#model` vs car model. <br>
  For example, a developer who sees the word "model" in the code may spend extra time trying to figure out whether it
  refers to a domain model or an FSD model. **Such collisions can disrupt the development process.**

When the project glossary contains terminology specific to FSD, it is critical to be careful when discussing these terms
with the team and non-technical stakeholders.

To communicate effectively with the team, it is recommended that the abbreviation "FSD" be used to prefix the
methodology terms. For example, when talking about a model, you might say, "We can define this in the FSD model layer."

Conversely, when communicating with non-technical stakeholders, it is better to limit the use of FSD terminology and
refrain from mentioning the internal structure of the code base.
