# Harvest Autotask

## Installation

To reproduce exactly the same Autotask environment in your development setup, you can use the following lockfile to install the same set of dependencies via `yarn install --frozen-lockfile`.

## Environment variables

Configured in `.env`.

### Autotask API

-   API_KEY
-   API_SECRET
-   AUTOTASK_ID

### Relay API

-   RELAY_API_KEY
-   RELAY_API_SECRET

### Alchemy API

-   ALCHEMY_API_KEY

## Autotask deployment

1. Build the autotask modules:

```
yarn build
```

2. Deploy the module to the autotask specified by an autotask ID:

```
yarn deploy <module name> <autotask ID>
```

E.g.

```
yarn deploy harvest fgbwrbg4-dt91-514l-k02v-7448w39160ip
```

Optionally set the `$AUTOTASK_ID` environment variable in `.env`.
