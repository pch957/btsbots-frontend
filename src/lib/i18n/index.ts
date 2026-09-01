import { useState, createContext, useContext } from 'react';
import zh from './locales/zh';
import en from './locales/en';
import ru from './locales/ru';

export type LangKey = 'zh' | 'en' | 'ru';
const dictionaries = { zh, en, ru };

interface I18nContextValue {
  lang: LangKey;
  setLang: (l: LangKey) => void;
  t: typeof zh;
}

export const I18nContext = createContext<I18nContextValue>({
  lang: 'zh',
  setLang: () => {},
  t: zh
});

export function useI18n() {
  return useContext(I18nContext);
}

export function useI18nProvider() {
  const [lang, setLangState] = useState<LangKey>(() => {
    return (localStorage.getItem('btsbots_lang') as LangKey) || 'zh';
  });

  const setLang = (newLang: LangKey) => {
    setLangState(newLang);
    localStorage.setItem('btsbots_lang', newLang);
  };

  const t = dictionaries[lang] || dictionaries.zh;
  return { lang, setLang, t };
}