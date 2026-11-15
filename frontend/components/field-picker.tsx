'use client';

import {useEffect, useId, useMemo, useRef, useState} from 'react';
import {ArrowUpRight, Check, ChevronDown, MapPin, Search, X} from 'lucide-react';
import {cropNames} from '@/lib/i18n';
import type {Field} from '@/lib/types';
import styles from './field-picker.module.css';

type Region = 'all' | 'usa' | 'europe' | 'ukraine' | 'own';
type Props = {
  fields: Field[];
  value: string;
  onChange: (id: string) => void;
  label?: string;
  compact?: boolean;
  className?: string;
};

function regionFor(field: Field): Region {
  const country = field.country?.toUpperCase();
  if (country === 'USA' || country === 'US') return 'usa';
  if (country === 'UA' || country === 'UKR') return 'ukraine';
  if (['FR', 'FRA', 'DE', 'DEU', 'GER', 'PL', 'POL', 'ES', 'ESP', 'IT', 'ITA', 'GB', 'GBR'].includes(country || '')) return 'europe';
  return 'own';
}

function countryName(field: Field) {
  const country = field.country?.toUpperCase();
  const names: Record<string, string> = {USA:'США',US:'США',UA:'Україна',UKR:'Україна',DE:'Німеччина',DEU:'Німеччина',FR:'Франція',FRA:'Франція',PL:'Польща',POL:'Польща'};
  return names[country || ''] || country || 'Ваше господарство';
}

/** A genuine outline of the supplied geometry, with latitude-corrected proportions. */
function FieldOutline({field, small = false}: {field: Field; small?: boolean}) {
  const paths = useMemo(() => {
    const rings = field.geometry?.coordinates || [];
    const points = rings.flat().filter(p => Number.isFinite(p[0]) && Number.isFinite(p[1]));
    if (!points.length) return '';
    const longitudeScale = Math.max(.05, Math.cos(points.reduce((n, p) => n + p[1], 0) / points.length * Math.PI / 180));
    const x = points.map(p => p[0] * longitudeScale), y = points.map(p => p[1]);
    const minX = Math.min(...x), maxX = Math.max(...x), minY = Math.min(...y), maxY = Math.max(...y);
    const scale = 70 / Math.max(maxX - minX, maxY - minY, .000001);
    const offsetX = (100 - (maxX - minX) * scale) / 2, offsetY = (100 - (maxY - minY) * scale) / 2;
    return rings.map(ring => ring.map((p, i) => `${i ? 'L' : 'M'}${((p[0] * longitudeScale - minX) * scale + offsetX).toFixed(2)},${((maxY - p[1]) * scale + offsetY).toFixed(2)}`).join(' ') + ' Z').join(' ');
  }, [field.geometry]);
  return <svg className={small ? styles.smallOutline : styles.outline} viewBox="0 0 100 100" aria-hidden="true"><path d={paths} fillRule="evenodd"/></svg>;
}

export default function FieldPicker({fields, value, onChange, label = 'Оберіть поле', compact = false, className = ''}: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [region, setRegion] = useState<Region>('all');
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const titleId = useId();
  const selected = fields.find(field => field.id === value) || fields[0];
  const regions: {id: Region; name: string}[] = [{id:'all',name:'Усі поля'},{id:'usa',name:'США'},{id:'europe',name:'Європа'},{id:'ukraine',name:'Україна'},{id:'own',name:'Інші / власні'}];
  const counts = useMemo(() => Object.fromEntries(regions.map(item => [item.id, item.id === 'all' ? fields.length : fields.filter(f => regionFor(f) === item.id).length])) as Record<Region, number>, [fields]);
  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('uk');
    return fields.filter(field => (region === 'all' || regionFor(field) === region) && (!query || [field.name, field.operator_name, countryName(field), cropNames.uk[field.crop_history.at(-1) || '']].filter(Boolean).join(' ').toLocaleLowerCase('uk').includes(query)))
      .sort((a, b) => Number(regionFor(b) === 'usa') - Number(regionFor(a) === 'usa') || Number(a.is_demo) - Number(b.is_demo) || a.name.localeCompare(b.name, 'uk'));
  }, [fields, region, search]);

  useEffect(() => {
    if (!open || !dialog.current) return;
    const node = dialog.current;
    if (!node.open) node.showModal();
    searchInput.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      if (node.open) node.close();
      document.body.style.overflow = previousOverflow;
      trigger.current?.focus();
    };
  }, [open]);

  function close() {setOpen(false)}
  function choose(field: Field) {onChange(field.id); close()}

  return <div className={`${styles.picker} ${compact ? styles.compact : ''} ${className}`}>
    <button type="button" className={styles.trigger} ref={trigger} aria-label={label} aria-haspopup="dialog" aria-expanded={open} disabled={!fields.length} onClick={() => {setSearch('');setRegion('all');setOpen(true)}}>
      {selected ? <><FieldOutline field={selected} small/><span className={styles.current}><small>{label}</small><strong>{selected.name}</strong><span>{countryName(selected)} · {selected.area_ha.toLocaleString('uk', {maximumFractionDigits:2})} га</span></span></> : <span className={styles.current}><strong>Полів ще немає</strong></span>}
      <ChevronDown size={16} className={styles.chevron}/>
    </button>
    {open && <dialog className={styles.dialog} ref={dialog} aria-labelledby={titleId} onCancel={event => {event.preventDefault();close()}} onClick={event => {if(event.target === event.currentTarget) {const bounds=event.currentTarget.getBoundingClientRect();if(event.clientX<bounds.left||event.clientX>bounds.right||event.clientY<bounds.top||event.clientY>bounds.bottom)close()}}}>
      <div className={styles.sheet}>
        <header className={styles.header}><div><span className={styles.eyebrow}>AGROSAS / FIELD EXPLORER</span><h2 id={titleId}>З яким полем працюємо?</h2><p>Оберіть власне поле або дослідіть приклад господарства.</p></div><button type="button" className={styles.close} aria-label="Закрити вибір поля" onClick={close}><X size={20}/></button></header>
        <div className={styles.filters}><label className={styles.search}><Search size={18}/><input ref={searchInput} aria-label="Пошук поля" placeholder="Назва, країна або культура" value={search} onChange={event => setSearch(event.target.value)}/>{search && <button type="button" aria-label="Очистити пошук поля" onClick={() => {setSearch('');searchInput.current?.focus()}}><X size={15}/></button>}</label><div className={styles.regions} role="group" aria-label="Регіон поля">{regions.filter(item => counts[item.id] > 0 || item.id === 'all').map(item => <button type="button" key={item.id} aria-pressed={region === item.id} className={region === item.id ? styles.activeRegion : ''} onClick={() => setRegion(item.id)}>{item.name}<span>{counts[item.id]}</span></button>)}</div></div>
        <div className={styles.results} aria-live="polite"><span>{filtered.length === fields.length ? `${fields.length} полів у просторі` : `Знайдено: ${filtered.length}`}</span><span>Контури — з геометрії поля</span></div>
        <div className={styles.grid}>{filtered.map(field => {
          const active = field.id === selected?.id;
          const crop = cropNames.uk[field.crop_history.at(-1) || ''];
          return <button type="button" key={field.id} className={`${styles.card} ${active ? styles.selected : ''}`} onClick={() => choose(field)} aria-label={`Відкрити поле ${field.name}`} aria-current={active ? 'true' : undefined}>
            <div className={styles.preview}><div className={styles.gridLines}/><FieldOutline field={field}/><span className={styles.country}><MapPin size={11}/>{countryName(field)}</span><span className={styles.selection}>{active ? <Check size={16}/> : <ArrowUpRight size={16}/>}</span></div>
            <div className={styles.cardBody}><span className={styles.kind}>{field.is_demo ? 'НАВЧАЛЬНИЙ ПРИКЛАД' : 'ВАШЕ ПОЛЕ'}</span><h3>{field.name}</h3><div className={styles.cardFacts}><strong>{field.area_ha.toLocaleString('uk', {maximumFractionDigits:2})}<small> га</small></strong><span>{crop || 'Культуру не вказано'}{crop && field.crop_origin === 'scenario_not_classification' && <small>культура сценарію</small>}</span></div><p className={styles.provenance}>{field.is_demo ? 'Приклад меж · не кадастрове підтвердження' : 'Межі, введені користувачем'}</p></div>
          </button>;
        })}</div>
        {!filtered.length && <div className={styles.empty}><Search size={28}/><h3>Полів за цим запитом немає</h3><p>Спробуйте іншу назву або відкрийте всі регіони.</p><button type="button" onClick={() => {setSearch('');setRegion('all')}}>Показати всі поля</button></div>}
        <footer className={styles.footer}><span>Приклади допомагають дослідити інструменти. Власники та культури сценаріїв не підтверджені.</span><kbd>Esc · закрити</kbd></footer>
      </div>
    </dialog>}
  </div>;
}
