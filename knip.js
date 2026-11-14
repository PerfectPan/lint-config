// The JSON file is the single source; `$schema` is only meaningful to editors reading the JSON.
import knipConfig from "./knip.json" with { type: "json" };

const { $schema: _schema, ...knip } = knipConfig;

export { knip };
