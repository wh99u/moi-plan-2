import { navigate } from '../route';

export type TasksView = 'month' | 'hours' | 'list' | 'goals';

let wanted: TasksView | null = null;

/** Another screen sends the owner to a particular section of the tasks. */
export function openTasks(view: TasksView) {
  wanted = view;
  navigate('tasks');
}

export const wantedView = () => wanted;
export const clearWanted = () => {
  wanted = null;
};
