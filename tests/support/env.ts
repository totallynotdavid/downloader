function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `${name} is required for this command. Set it in .env or the environment.`,
    );
  }
  return value;
}

export const env = {
  // Optional override for the cassette store; defaults to tests/cassettes.
  cassetteDir: process.env["EVAL_CASSETTES"],

  // Full proxy "http://user:pass@host:port". When set it wins over Geonode creds.
  proxyUrl: process.env["EVAL_PROXY_URL"],

  // Geonode residential gateway credentials. Required only when recording without
  // an explicit proxyUrl; each accessor throws if the var is missing.
  geonodeUser: () => required("GEONODE_USERNAME"),
  geonodePassword: () => required("GEONODE_PASSWORD"),
};
