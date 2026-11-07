type Profile = {
  name: string;
};

const profile: Profile = { name: "Ada" };

export function displayName(): string {
  return profile?.name;
}

export function nameOrEmpty(): string {
  return profile.name ?? "";
}
