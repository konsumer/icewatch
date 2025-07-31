const translations = {};

translations["en"] = [
  "Report ICE",
  "Could not retrieve your location. Please ensure location services are enabled.",
  "Geolocation is not supported by this browser.",
];

translations["es"] = [
  "Informe ICE",
  "No se pudo recuperar tu ubicación. Asegúrate de que los servicios de ubicación estén habilitados.",
  "Este navegador no admite la geolocalización.",
];

const getNavigatorLanguage = () => {
  let l = "en";
  if (navigator.languages && navigator.languages.length) {
    l = navigator.languages[0];
  } else {
    l =
      navigator.userLanguage ||
      navigator.language ||
      navigator.browserLanguage ||
      "en";
  }
  return l.split(/[-_]/g).at(0);
};

const t = (t) => {
  const l = getNavigatorLanguage();
  return translations[l][translations["en"].indexOf(t)] || t;
};
export default t;
