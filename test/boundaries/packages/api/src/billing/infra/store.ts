import { Client } from "@acme/sdk";
import { join } from "node:path";

export const storePath = (name: string): string => join("stores", name);
export const useSdk = (): unknown => Client;
