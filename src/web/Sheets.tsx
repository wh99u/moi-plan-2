import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useRef, useState, type CSSProperties, type FormEvent } from 'react';
import { ACCENTS, setAccent, useAccent } from '../app/accent';
import { setLook, useLook, type Look } from '../app/look';
import { GOOGLE_CLIENT_ID, renderGoogleButton } from '../app/google';
import { setProfile, useProfile } from '../app/profile';
import { closeSheet, useSheet } from '../app/sheet';
import { setThemePref, useTheme, type ThemePref } from '../app/theme';
import { Sheet } from '../app/ui/Sheet';
import { isDemo } from '../lib/appStore';
import { Icon } from '../ui/Icon';
import { MoneySheets } from './money/sheets';
import { EXTRAS, navigate } from './route';
import { Seg } from './Seg';
import { ShopSheets } from './shop/sheets';
import { useSyncStatus } from './sync/engine';
import { sync } from './sync/site';
import { ShiftSheet } from './tasks/ShiftSheet';

export function Sheets() {
  const open = useSheet();
  return (
    <>
      <Sheet open={open === 'more'} onClose={closeSheet} title="Ещё">
        <MoreGrid />
      </Sheet>
      <Sheet open={open === 'profile'} onClose={closeSheet} title="Профиль">
        <ProfileForm />
      </Sheet>
      <MoneySheets />
      <ShopSheets />
      <ShiftSheet />
    </>
  );
}

function MoreGrid() {
  return (
    <div className="more-grid">
      {EXTRAS.map((x, i) => (
        <motion.button
          key={x.id}
          type="button"
          className="more-tile"
          onClick={() => {
            closeSheet();
            navigate(x.id);
          }}
          initial={{ opacity: 0, y: 18, scale: 0.94 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ delay: 0.08 + i * 0.05, type: 'spring', stiffness: 420, damping: 30 }}
          whileTap={{ scale: 0.95 }}
        >
          <span className="more-icon">
            <Icon name={x.icon} size={22} />
          </span>
          <span className="more-text">
            <strong>{x.label}</strong>
            <span>{x.hint}</span>
          </span>
        </motion.button>
      ))}
    </div>
  );
}

function ProfileForm() {
  const { name, via } = useProfile();
  const { pref } = useTheme();
  const [draft, setDraft] = useState(name);
  const slot = useRef<HTMLDivElement>(null);
  const showGoogle = !!GOOGLE_CLIENT_ID && via !== 'google';

  useEffect(() => {
    if (!showGoogle || !slot.current) return;
    renderGoogleButton(slot.current, (p) => setProfile({ name: p.name, picture: p.picture, via: 'google' })).catch(() => {
      /* offline or blocked: the name can still be typed by hand */
    });
  }, [showGoogle]);

  const save = (e: FormEvent) => {
    e.preventDefault();
    setProfile({ name: draft.trim(), via: 'manual', picture: undefined });
    closeSheet();
  };

  return (
    <form className="form" onSubmit={save}>
      <label className="form-label" htmlFor="profile-name">
        Как к тебе обращаться
      </label>
      <input id="profile-name" className="field" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Имя" maxLength={40} autoComplete="given-name" />
      {showGoogle && (
        <div className="google-in">
          <div ref={slot} />
          <span>или имя подтянется из аккаунта Google</span>
        </div>
      )}
      <span className="form-label">Тема</span>
      <Seg
        value={pref}
        onChange={(p: ThemePref) => setThemePref(p)}
        options={[
          { id: 'system', label: 'Как в системе' },
          { id: 'light', label: 'Светлая' },
          { id: 'dark', label: 'Тёмная' },
        ]}
        label="Тема"
      />
      <span className="form-label">Цвет сайта</span>
      <AccentPick />
      <span className="form-label">Стиль</span>
      <LookPick />
      <motion.button type="submit" className="primary-btn" whileTap={{ scale: 0.96 }}>
        Сохранить
      </motion.button>
      <SyncBlock />
    </form>
  );
}

/** Glass, or the same site solid and matte. */
function LookPick() {
  const look = useLook();
  return (
    <Seg
      value={look}
      onChange={(l: Look) => setLook(l)}
      options={[
        { id: 'glass', label: 'Стекло' },
        { id: 'flat', label: 'Без стекла' },
      ]}
      label="Стиль"
    />
  );
}

function AccentPick() {
  const accent = useAccent();
  return (
    <div className="accent-pick" role="radiogroup" aria-label="Цвет сайта">
      {ACCENTS.map((a) => (
        <button key={a.id} type="button" role="radio" aria-checked={accent === a.id} aria-label={a.label} title={a.label} className="accent-dot" style={{ '--dot': a.swatch } as CSSProperties} onClick={() => setAccent(a.id)}>
          <AnimatePresence initial={false}>
            {accent === a.id && (
              <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} transition={{ type: 'spring', stiffness: 460, damping: 26 }}>
                <Icon name="check" size={16} stroke={3} />
              </motion.span>
            )}
          </AnimatePresence>
        </button>
      ))}
    </div>
  );
}

const TOKEN_PAGE = 'https://github.com/settings/tokens/new?scopes=gist&description=%D0%9C%D0%BE%D0%B9%20%D0%BF%D0%BB%D0%B0%D0%BD';

function syncedAgo(at?: number) {
  if (!at) return '';
  const min = Math.round((Date.now() - at) / 60000);
  return min < 1 ? 'только что' : min < 60 ? `${min} мин назад` : new Date(at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

/** One account on every device: the owner's GitHub, and a token that reaches only its gists. */
function SyncBlock() {
  const status = useSyncStatus(sync);
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState('');
  const [howTo, setHowTo] = useState(false);

  if (isDemo) return null;

  const connect = async () => {
    setBusy(true);
    setProblem('');
    try {
      await sync.connect(token);
      setToken('');
    } catch (e) {
      setProblem(e instanceof Error ? e.message : 'Не получилось подключить');
    } finally {
      setBusy(false);
    }
  };

  if (status.state === 'off') {
    return (
      <section className="sync">
        <h3>Синхронизация между устройствами</h3>
        <p className="form-hint">Данные будут одни и те же на телефоне и на компьютере. Вход через твой аккаунт GitHub, данные лежат там же в зашифрованном виде</p>
        <button type="button" className="scan-link" aria-expanded={howTo} onClick={() => setHowTo(!howTo)}>
          <Icon name="link" size={18} />
          Как подключить
        </button>
        {howTo && (
          <ol className="sync-steps">
            <li>
              <a href={TOKEN_PAGE} target="_blank" rel="noreferrer">
                Открой страницу создания токена
              </a>
              . Галочка gist уже стоит, срок поставь «No expiration»
            </li>
            <li>Нажми Generate token и скопируй его</li>
            <li>Вставь сюда. На другом устройстве вставь этот же токен</li>
          </ol>
        )}
        <input className="field" type="password" value={token} onChange={(e) => setToken(e.target.value)} placeholder="Токен GitHub" aria-label="Токен GitHub" autoComplete="off" autoCapitalize="off" spellCheck={false} />
        {problem && <p className="form-note">{problem}</p>}
        <motion.button type="button" className="primary-btn primary-btn--quiet" disabled={!token.trim() || busy} whileTap={{ scale: 0.96 }} onClick={() => void connect()}>
          {busy ? 'Подключаю' : 'Подключить'}
        </motion.button>
      </section>
    );
  }

  return (
    <section className="sync">
      <h3>Синхронизация между устройствами</h3>
      <p className="sync-state">
        <i className={`sync-dot is-${status.state}`} />
        <span>
          {status.login}
          <small>{status.state === 'busy' ? 'Синхронизирую' : status.state === 'error' ? status.message : `Обновлено ${syncedAgo(status.at)}`}</small>
        </span>
      </p>
      <div className="form-two">
        <button type="button" className="scan-link" disabled={status.state === 'busy'} onClick={() => void sync.syncNow()}>
          Обновить
        </button>
        <button type="button" className="scan-link" onClick={sync.disconnect}>
          Отключить
        </button>
      </div>
    </section>
  );
}
