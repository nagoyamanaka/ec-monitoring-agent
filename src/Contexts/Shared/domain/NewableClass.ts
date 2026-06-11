export interface NewableClass<T> extends Function {
  new (...args: unknown[]): T;
}
