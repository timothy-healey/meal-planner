/**
 * Minimal typings for the slice of `node:sqlite` the migration integration
 * test uses.
 *
 * Declared locally rather than adding "node" to tsconfig's `types`: this is a
 * React Native app, and exposing node globals project-wide would let app code
 * reference APIs that don't exist at runtime. The test needs them; the app
 * must not have them.
 */
declare module 'node:sqlite' {
  export class StatementSync {
    all(...params: unknown[]): unknown[];
    get(...params: unknown[]): unknown;
    run(...params: unknown[]): { changes: number; lastInsertRowid: number };
  }

  export class DatabaseSync {
    constructor(path: string);
    exec(sql: string): void;
    prepare(sql: string): StatementSync;
    close(): void;
  }
}
