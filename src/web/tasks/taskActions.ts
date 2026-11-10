import { setNotice } from '../../app/money/auto';
import { actions } from '../../lib/appStore';
import type { Task } from '../../lib/types';
import { pulseWave } from '../Wave';
import { nextRepeat } from './logic';

/** Marks it done or back; a repeating one comes back as a new task on its next day. */
export function completeTask(task: Task) {
  if (!task.done) {
    pulseWave();
    const next = nextRepeat(task);
    if (next) {
      const { id: _id, updatedAt: _at, done: _done, ...rest } = task;
      actions.addTask({ ...rest, due: next, subtasks: rest.subtasks?.map((s) => ({ ...s, done: false })) });
    }
  }
  actions.toggleTask(task.id);
}

/** Gone at once, with a moment to take it back instead of a second «are you sure». */
export function deleteTaskUndoable(task: Task) {
  actions.deleteTask(task.id);
  setNotice({ text: `«${task.title || 'Задача'}» удалена`, undo: () => actions.updateTask(task.id, { deleted: undefined }) });
}
