import { getProfile, setProfile, subscribeProfile } from '../../app/profile';
import { actions, appStore } from '../../lib/appStore';
import { imagesChanged } from '../../lib/images';
import { createSync } from './engine';

/** The site's own synchronisation, with its store and its profile. */
export const sync = createSync(
  {
    get: appStore.get,
    replace: appStore.replace,
    subscribe: appStore.subscribe,
    afterMerge: () => {
      actions.settleShifts();
      imagesChanged();
    },
  },
  {
    read: () => {
      const { name, picture } = getProfile();
      return { name, picture };
    },
    write: (p) => setProfile({ ...(p.name !== undefined ? { name: p.name } : {}), picture: p.picture }),
    subscribe: subscribeProfile,
  },
);
