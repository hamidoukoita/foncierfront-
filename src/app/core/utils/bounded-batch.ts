import { Observable, from, of } from 'rxjs';
import { catchError, map, mergeMap, take, tap, toArray } from 'rxjs/operators';

export type BatchOutcome<T> =
  | { index: number; ok: true; value: T }
  | { index: number; ok: false; error: unknown };

/**
 * Exécute des appels asynchrones avec une concurrence bornée (évite d'envoyer 150 requêtes
 * simultanées au backend). Une erreur n'interrompt pas le lot : elle est rapportée par index.
 */
export function runBounded<T>(
  tasks: ReadonlyArray<() => Observable<T>>,
  concurrency = 5,
  onProgress?: (done: number, total: number) => void,
): Observable<BatchOutcome<T>[]> {
  if (!tasks.length) return of([]);
  let done = 0;
  return from(tasks.map((task, index) => ({ task, index }))).pipe(
    mergeMap(
      ({ task, index }) =>
        task().pipe(
          take(1),
          map((value): BatchOutcome<T> => ({ index, ok: true, value })),
          catchError((error: unknown) => of<BatchOutcome<T>>({ index, ok: false, error })),
        ),
      concurrency,
    ),
    tap(() => onProgress?.(++done, tasks.length)),
    toArray(),
    map((list) => list.sort((a, b) => a.index - b.index)),
  );
}
