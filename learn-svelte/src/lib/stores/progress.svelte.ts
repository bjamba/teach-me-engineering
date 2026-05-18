/**
 * Per-learner progress, persisted in localStorage under a course-scoped
 * namespace so multiple teach-me curricula can share an origin without
 * colliding.
 *
 * This file is itself a small object lesson. It is a class with $state on
 * its fields. That class instance is exported once and imported anywhere.
 * Every component that touches `.completed` or `.byLesson` automatically
 * re-renders when those values change. There is no Provider, no Context,
 * no useStore hook. Read it, write it, that's it.
 */

import { browser } from '$app/environment';

const NS = 'svelte_';
const KEY = `${NS}progress_v1`;

type Persisted = {
  completed: Record<string, true>;
  startedAt: string | null;
  lastSession: string | null;
  totalSessions: number;
};

function load(): Persisted {
  if (!browser) {
    return { completed: {}, startedAt: null, lastSession: null, totalSessions: 0 };
  }
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) {
      return {
        completed: {},
        startedAt: null,
        lastSession: null,
        totalSessions: 0
      };
    }
    return JSON.parse(raw);
  } catch {
    return { completed: {}, startedAt: null, lastSession: null, totalSessions: 0 };
  }
}

class Progress {
  completed = $state<Record<string, true>>({});
  startedAt = $state<string | null>(null);
  lastSession = $state<string | null>(null);
  totalSessions = $state(0);

  constructor() {
    const initial = load();
    this.completed = initial.completed;
    this.startedAt = initial.startedAt;
    this.lastSession = initial.lastSession;
    this.totalSessions = initial.totalSessions;

    if (browser) {
      $effect.root(() => {
        $effect(() => {
          const snapshot: Persisted = {
            completed: this.completed,
            startedAt: this.startedAt,
            lastSession: this.lastSession,
            totalSessions: this.totalSessions
          };
          try {
            localStorage.setItem(KEY, JSON.stringify(snapshot));
          } catch {
            /* quota exceeded — silent */
          }
        });
      });
    }
  }

  isComplete(lessonKey: string): boolean {
    return Boolean(this.completed[lessonKey]);
  }

  markComplete(lessonKey: string) {
    if (!this.completed[lessonKey]) {
      this.completed = { ...this.completed, [lessonKey]: true };
    }
    this.touchSession();
  }

  toggle(lessonKey: string) {
    if (this.completed[lessonKey]) {
      const { [lessonKey]: _drop, ...rest } = this.completed;
      this.completed = rest;
    } else {
      this.completed = { ...this.completed, [lessonKey]: true };
    }
    this.touchSession();
  }

  touchSession() {
    const today = new Date().toISOString().slice(0, 10);
    if (!this.startedAt) this.startedAt = today;
    if (this.lastSession !== today) {
      this.lastSession = today;
      this.totalSessions += 1;
    }
  }

  get completedCount(): number {
    return Object.keys(this.completed).length;
  }

  reset() {
    this.completed = {};
    this.startedAt = null;
    this.lastSession = null;
    this.totalSessions = 0;
  }
}

export const progress = new Progress();

export function lessonKey(moduleSlug: string, lessonSlug: string): string {
  return `${moduleSlug}/${lessonSlug}`;
}
