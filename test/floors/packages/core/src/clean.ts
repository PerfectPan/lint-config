// The resolver floor must actually participate: a .js specifier resolves to its .ts sibling and the
// package root and subpath resolve through the tsconfig paths of the declared dependency.
import { floorSiblingValue } from "./sibling.js";
import { libRootValue } from "@fixture/lib";
import { libUtilValue } from "@fixture/lib/util.js";

export const floorCoreValue = floorSiblingValue + libRootValue + libUtilValue;
