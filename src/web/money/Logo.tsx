import { useState } from 'react';
import { logoDomain, logoSources, monogram } from './logos';

interface Props {
  /** The purchase or card it stands for. */
  title: string;
  /** Known outright, as for the cards. */
  domain?: string;
  size?: number;
}

/** The brand's own logo when there is one, letters when the sources have nothing or are out of reach. */
export function Logo({ title, domain, size = 44 }: Props) {
  const site = domain ?? logoDomain(title);
  const [failed, setFailed] = useState({ site, count: 0 });
  // A new name starts from the first source again.
  const count = failed.site === site ? failed.count : 0;
  const sources = site ? logoSources(site) : [];
  const src = sources[count];
  const next = () => setFailed({ site, count: count + 1 });

  return (
    <span className={`logo${src ? '' : ' logo--letters'}`} style={{ width: size, height: size, fontSize: size * 0.4 }} aria-hidden="true">
      {src ? (
        <img
          key={src}
          src={src}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={next}
          // A service that has no logo answers with an empty pixel rather than an error.
          onLoad={(e) => e.currentTarget.naturalWidth < 8 && next()}
        />
      ) : (
        monogram(title)
      )}
    </span>
  );
}
