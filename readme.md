# @FFGFlash/ECS

A simple Entity Component System written in TypeScript for creating games.

## TODO

- [x] Create Entities & Components
- [x] Register Systems
- [x] Efficiently Query for Entities
- [x] Add More System Options
  - [x] Add labels, before and after (system) options to give more control over execution order.
  - [ ] ~~Enable the ability to turn off inferred dependencies~~
    - Decided to make dependencies explicitly inferred.
- [x] Add Resources (Global data for use within systems)
  - ~~Preferably this would work within the existing query system, so probably a refactor.~~
    - Yeah I was tired when I wrote this, no it won't work within the the existing query system xD
- [x] Cleanup, I wrote most of this on no sleep, so some types are a bit all over the place. :3
  - Ended up doing a major overhaul of everything, types are much much cleaner 👍
- [ ] Add quality of life features, such as math libraries like Vector classes and more.

Should I refactor this to be a mono-repo instead and make things like Vectors addons?
