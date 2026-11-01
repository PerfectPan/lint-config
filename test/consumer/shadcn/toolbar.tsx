// Outside components/ui: controls come from the shadcn/ui files; Slot, a composition helper, is allowed.
import { Slot } from "@radix-ui/react-slot";

import { Button } from "./components/ui/button.js";

export function Toolbar(): JSX.Element {
  return (
    <Slot>
      <Button label="Save" />
    </Slot>
  );
}
