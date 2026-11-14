export function notifyText(listeners: Iterable<TextListener>, event: TextEvent): void {
  for (const listener of listeners) {
    try {
      listener(event);
    } catch {
      // These observers are optional.
    }
  }
}

export function notifyNumber(listeners: Iterable<NumberListener>, event: NumberEvent): void {
  for (const listener of listeners) {
    try {
      listener(event);
    } catch {
      // These observers are optional.
    }
  }
}
