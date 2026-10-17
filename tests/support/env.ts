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
  cassetteDir: process.env["EVAL_CASSETTES"],
  proxyUrl: process.env["EVAL_PROXY_URL"],
  geonodeUser: () => required("GEONODE_USERNAME"),
  geonodePassword: () => required("GEONODE_PASSWORD"),
};
