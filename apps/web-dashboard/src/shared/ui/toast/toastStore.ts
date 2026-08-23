import { create } from 'zustand';

export type ToastType = 'success' | 'error' | 'info' | 'warning' | 'loading';

export interface ToastAction {
  label:   string;
  onClick: () => void;
}

export interface ToastOptions {
  /** Reuse an id to *update* a toast in place — a `loading` becoming a `success`. */
  id?:          string;
  description?: string;
  /** Milliseconds on screen. `Infinity` pins it until dismissed; the default depends on type. */
  duration?:    number;
  action?:      ToastAction;
  /**
   * Makes the whole card a target rather than just its action link.
   *
   * For a toast that is really a *card* — something that waits to be dealt with, like a
   * finished audit — the action is the point of the thing, and asking someone to hit a
   * small link inside a notification they can already see is a needless second aim.
   * Dismisses on click.
   */
  onClick?:     () => void;
}

export interface Toast {
  id:           string;
  type:         ToastType;
  title:        string;
  description?: string;
  duration:     number;
  action?:      ToastAction;
  onClick?:     () => void;
  /** Bumped whenever an existing toast is updated, so its timer restarts from the change. */
  version:      number;
}

/**
 * How long each kind stays.
 *
 * An error outlasts a success because it usually carries something to read, and because
 * the cost of missing it is higher. A loading toast has no business disappearing on its
 * own — it is a promise that something is still happening, and the thing that finishes it
 * is the work, not a clock.
 */
const DEFAULT_DURATION: Record<ToastType, number> = {
  success: 4000,
  info:    4500,
  warning: 6000,
  error:   7000,
  loading: Infinity,
};

/**
 * Beyond this the stack stops being a stack and becomes a wall. The oldest goes: it has
 * been on screen longest and is the one already read.
 */
const MAX_VISIBLE = 4;

interface ToastStore {
  toasts: Toast[];
  push:   (type: ToastType, title: string, options?: ToastOptions) => string;
  dismiss: (id: string) => void;
  clear:  () => void;
}

let counter = 0;
const nextId = () => `t${++counter}`;

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],

  push: (type, title, options = {}) => {
    const id = options.id ?? nextId();
    const duration = options.duration ?? DEFAULT_DURATION[type];

    set((state) => {
      const existing = state.toasts.find(t => t.id === id);

      // Updating in place rather than stacking a second card: "Running audit…" turning
      // into "Audit complete" is one event with two states, and showing both would read
      // as two things having happened.
      if (existing) {
        return {
          toasts: state.toasts.map(t => t.id === id
            ? {
                ...t, type, title, duration, version: t.version + 1,
                ...(options.description !== undefined ? { description: options.description } : { description: undefined }),
                ...(options.action !== undefined ? { action: options.action } : { action: undefined }),
            ...(options.onClick !== undefined ? { onClick: options.onClick } : { onClick: undefined }),
              }
            : t),
        };
      }

      const toast: Toast = {
        id, type, title, duration, version: 0,
        ...(options.description ? { description: options.description } : {}),
        ...(options.action ? { action: options.action } : {}),
        ...(options.onClick ? { onClick: options.onClick } : {}),
      };
      const next = [...state.toasts, toast];
      return { toasts: next.length > MAX_VISIBLE ? next.slice(next.length - MAX_VISIBLE) : next };
    });

    return id;
  },

  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter(t => t.id !== id) })),
  clear:   ()   => set({ toasts: [] }),
}));

/**
 * Raise a toast from anywhere — an event handler, a hook, a catch block, a store.
 *
 * A plain function rather than a hook on purpose: most of the places worth announcing
 * something are not components (an API error handler, a socket callback), and a rule that
 * says "only from a component" is a rule that gets worked around.
 */
function make(type: ToastType) {
  return (title: string, options?: ToastOptions) => useToastStore.getState().push(type, title, options);
}

export const toast = {
  success: make('success'),
  error:   make('error'),
  info:    make('info'),
  warning: make('warning'),
  loading: make('loading'),
  dismiss: (id: string) => useToastStore.getState().dismiss(id),
  clear:   ()           => useToastStore.getState().clear(),

  /**
   * One toast for the whole life of an async task: pending, then resolved or rejected,
   * in the same card. Returns the promise untouched so it can be awaited as before.
   */
  promise<T>(
    promise: Promise<T>,
    messages: {
      loading: string;
      success: string | ((value: T) => string);
      error:   string | ((err: unknown) => string);
    },
  ): Promise<T> {
    const id = useToastStore.getState().push('loading', messages.loading);
    return promise.then(
      (value) => {
        useToastStore.getState().push('success', typeof messages.success === 'function' ? messages.success(value) : messages.success, { id });
        return value;
      },
      (err: unknown) => {
        useToastStore.getState().push('error', typeof messages.error === 'function' ? messages.error(err) : messages.error, { id });
        throw err;
      },
    );
  },
};
