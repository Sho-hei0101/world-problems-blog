const DEFAULT_LOCALES = ["en", "es", "fr", "de", "ja"];

const SUBREDDITS_BY_LOCALE = {
  en: [
    "NoStupidQuestions",
    "AskReddit",
    "personalfinance",
    "Frugal",
    "ExplainLikeImFive",
    "relationships",
    "legaladvice"
  ],
  es: [
    "askspain",
    "spain",
    "mexico",
    "argentina",
    "asklatinamerica"
  ],
  fr: ["france", "quebec", "franceinfos", "paris", "askfrance"],
  de: ["de", "germany", "fragreddit", "de_IAmA", "Finanzen"],
  ja: ["japan", "japanlife", "askjapan", "ja", "newsokur"]
};

function getSubredditsForLocale(locale) {
  return SUBREDDITS_BY_LOCALE[locale] || SUBREDDITS_BY_LOCALE.en;
}

module.exports = {
  DEFAULT_LOCALES,
  SUBREDDITS_BY_LOCALE,
  getSubredditsForLocale
};
