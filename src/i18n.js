// -----------------------------------------------------------------------------
// Runtime texts shown in Gladys (connection status, widget, button) in
// English and French, and the summaries sent to the scenes, also in Dutch
// (the language of the summaries is a setting: a scene has no language).
// -----------------------------------------------------------------------------

const LOCALES = { en: 'en-GB', fr: 'fr-FR', nl: 'nl-NL' };

/** 3.2 -> "3.2" / "3,2". */
export const decimal = (value, language) =>
  new Intl.NumberFormat(LOCALES[language] ?? 'en-GB', { maximumFractionDigits: 1 }).format(value);

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

export const T = {
  ok: (watched) => ({
    en: `Buienradar answers. Rain forecast watched for ${plural(watched, 'house')}.`,
    fr: `Buienradar répond. Prévision de pluie suivie pour ${plural(watched, 'maison')}.`,
  }),
  noHouse: {
    en: 'Weather ready. No house with a location in Gladys: the rain triggers and widget need one (Settings → Houses).',
    fr: 'Météo prête. Aucune maison localisée dans Gladys : les déclencheurs et le widget de pluie en ont besoin (Paramètres → Maisons).',
  },
  someOutside: (n) => ({
    en: ` ${plural(n, 'house')} outside the coverage (Netherlands and Belgium).`,
    fr: ` ${plural(n, 'maison')} hors couverture (Pays-Bas et Belgique).`,
  }),
  allOutside: {
    en: 'Your houses are outside the coverage of Buienradar (the Netherlands and Belgium).',
    fr: 'Vos maisons sont hors de la couverture de Buienradar (Pays-Bas et Belgique).',
  },
  feedDown: (message) => ({
    en: `Buienradar does not answer: ${message}. The weather comes back by itself.`,
    fr: `Buienradar ne répond pas : ${message}. La météo reviendra d'elle-même.`,
  }),
  rainDown: (message) => ({
    en: `The Buienradar rain forecast does not answer: ${message}. Retrying at the next check.`,
    fr: `La prévision de pluie de Buienradar ne répond pas : ${message}. Nouvel essai à la prochaine vérification.`,
  }),
  /** Thrown to the core, which shows it: English only. */
  outsideError:
    'Outside the Buienradar coverage: no Buienradar station within 80 km (Buienradar covers the Netherlands and Belgium).',
  unknownHouse: (name) => `No house named "${name}" with a location in Gladys.`,
  noLocatedHouse: 'No house with a location in Gladys (Settings → Houses).',
  houseOutside: (name) =>
    `The house "${name}" is outside the Buienradar rain forecast (the Netherlands and Belgium).`,

  /** Labels of the radar maps in the weather widget (50 characters at most). */
  radar: {
    'radar-nl': {
      en: 'Rain radar Netherlands · Buienradar.nl',
      fr: 'Radar pluie Pays-Bas · Buienradar.nl',
    },
    'radar-be': {
      en: 'Rain radar Belgium · Buienradar.nl',
      fr: 'Radar pluie Belgique · Buienradar.nl',
    },
  },

  widget: {
    title: (name) => ({ en: `Rain · ${name}`.slice(0, 40), fr: `Pluie · ${name}`.slice(0, 40) }),
    nextRain: { en: 'Next rain', fr: 'Prochaine pluie' },
    now: { en: 'Now', fr: 'Maintenant' },
    dry: { en: 'Dry', fr: 'Sec' },
    max: { en: 'Max intensity', fr: 'Intensité max' },
    total: { en: 'Total 2 h', fr: 'Cumul 2 h' },
    chart: { en: 'Rain, next 2 hours', fr: 'Pluie, 2 prochaines heures' },
    caption: (time) => ({
      en: `Data: Buienradar.nl · ${time}`,
      fr: `Données : Buienradar.nl · ${time}`,
    }),
    heading: { en: 'Buienradar rain', fr: 'Pluie Buienradar' },
    noHouse: {
      en: 'No house with a location: set it in Gladys (Settings → Houses).',
      fr: 'Aucune maison localisée : placez-la dans Gladys (Paramètres → Maisons).',
    },
    unknownHouse: (name) => ({
      en: `No house named "${name}" with a location in Gladys.`,
      fr: `Aucune maison localisée nommée « ${name} » dans Gladys.`,
    }),
    outside: {
      en: 'Buienradar forecasts the rain in the Netherlands and Belgium only.',
      fr: "Buienradar ne prévoit la pluie qu'aux Pays-Bas et en Belgique.",
    },
    down: {
      en: 'Buienradar does not answer, retrying soon.',
      fr: 'Buienradar ne répond pas, nouvel essai bientôt.',
    },
  },

  /** Summaries for the scenes: { en, fr, nl }, the caller picks the configured language. */
  summary: {
    dry: (house) => ({
      en: `No rain expected in the next 2 hours at ${house}.`,
      fr: `Pas de pluie prévue dans les 2 prochaines heures à ${house}.`,
      nl: `Geen regen verwacht in de komende 2 uur bij ${house}.`,
    }),
    raining: (house, max, dry) => ({
      en: `Raining at ${house} (up to ${decimal(max, 'en')} mm/h)${dry ? `, dry from ${dry.time} (in ${dry.minutes} min).` : ', for the next 2 hours.'}`,
      fr: `Il pleut à ${house} (jusqu'à ${decimal(max, 'fr')} mm/h)${dry ? `, sec à partir de ${dry.time} (dans ${dry.minutes} min).` : ', pour les 2 prochaines heures.'}`,
      nl: `Het regent bij ${house} (tot ${decimal(max, 'nl')} mm/u)${dry ? `, droog vanaf ${dry.time} (over ${dry.minutes} min).` : ', de komende 2 uur.'}`,
    }),
    expected: (house, start, max) => ({
      en: `Rain expected at ${house} from ${start.time} (in ${start.minutes} min), up to ${decimal(max, 'en')} mm/h.`,
      fr: `Pluie attendue à ${house} à partir de ${start.time} (dans ${start.minutes} min), jusqu'à ${decimal(max, 'fr')} mm/h.`,
      nl: `Regen verwacht bij ${house} vanaf ${start.time} (over ${start.minutes} min), tot ${decimal(max, 'nl')} mm/u.`,
    }),
    stopped: (house, next) => ({
      en: `The rain stopped at ${house}.${next ? ` Next rain in ${next} min.` : ' Dry for the next 2 hours.'}`,
      fr: `La pluie s'est arrêtée à ${house}.${next ? ` Prochaine pluie dans ${next} min.` : ' Sec pour les 2 prochaines heures.'}`,
      nl: `Het is gestopt met regenen bij ${house}.${next ? ` Volgende regen over ${next} min.` : ' Droog voor de komende 2 uur.'}`,
    }),
  },
};
