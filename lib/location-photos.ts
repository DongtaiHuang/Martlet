type LocationPhoto = {
  src: string;
  photographer: string;
  source: string;
  license: string;
  licenseUrl: string;
};

// Each WebP is distributed under the license linked here.
export const LOCATION_PHOTOS: Partial<Record<string, LocationPhoto>> = {
  "arts-building": {
    src: "/images/locations/arts-building.webp",
    photographer: "D. Benjamin Miller",
    source: "https://commons.wikimedia.org/wiki/File:Arts_Building%2C_McGill_University%2C_Aug_31_2022.jpg",
    license: "CC0",
    licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
  },
  "roddick-gates": {
    src: "/images/locations/roddick-gates.webp",
    photographer: "D. Benjamin Miller",
    source: "https://commons.wikimedia.org/wiki/File:Roddick_Gates%2C_December_18%2C_2023.jpg",
    license: "CC0",
    licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
  },
  "redpath-museum": {
    src: "/images/locations/redpath-museum.webp",
    photographer: "Daderot",
    source: "https://commons.wikimedia.org/wiki/File:Redpath_Museum_-_McGill_University_-_Montreal%2C_Canada_-_DSC07739.jpg",
    license: "CC0",
    licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
  },
  "redpath-library": {
    src: "/images/locations/redpath-library.webp",
    photographer: "Jeangagnon",
    source: "https://commons.wikimedia.org/wiki/File:McGill_University_downtown_campus_12.JPG",
    license: "CC BY-SA 3.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/3.0/",
  },
  "trottier-building": {
    src: "/images/locations/trottier-building.webp",
    photographer: "Jeangagnon",
    source: "https://commons.wikimedia.org/wiki/File:Lorne_M._Trottier_Building_McGill.JPG",
    license: "CC BY-SA 3.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/3.0/",
  },
  "burnside-hall": {
    src: "/images/locations/burnside-hall.webp",
    photographer: "Jeangagnon",
    source: "https://commons.wikimedia.org/wiki/File:Burnside_Hall_01.jpg",
    license: "CC BY-SA 3.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/3.0/",
  },
  "leacock-building": {
    src: "/images/locations/leacock-building.webp",
    photographer: "Jonahrapp",
    source: "https://commons.wikimedia.org/wiki/File:Leacock_Building.jpg",
    license: "CC BY 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
  },
  "mcconnell-engineering": {
    src: "/images/locations/mcconnell-engineering.webp",
    photographer: "Andrew Kuchling",
    source: "https://commons.wikimedia.org/wiki/File:McConnell_Engineering_Building_2007.jpg",
    license: "CC BY-SA 2.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/2.0/",
  },
  "mclennan-library": {
    src: "/images/locations/mclennan-library.webp",
    photographer: "Happysquirrel",
    source: "https://commons.wikimedia.org/wiki/File:McLennan_Library_building.jpg",
    license: "CC BY-SA 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
  },
  "otto-maass": {
    src: "/images/locations/otto-maass.webp",
    photographer: "Jeangagnon",
    source: "https://commons.wikimedia.org/wiki/File:Maass_Chemistry_Building_-_01.jpg",
    license: "CC BY-SA 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
  },
  "atwater-market": {
    src: "/images/locations/atwater-market.webp",
    photographer: "Anna Frodesiak",
    source: "https://commons.wikimedia.org/wiki/File:Atwater_Market_-_exterior_01.JPG",
    license: "Public domain",
    licenseUrl: "https://commons.wikimedia.org/wiki/File:Atwater_Market_-_exterior_01.JPG#Licensing",
  },
  "jean-talon-market": {
    src: "/images/locations/jean-talon-market.webp",
    photographer: "Gene.arboit",
    source: "https://commons.wikimedia.org/wiki/File:March%C3%A9_Jean-Talon%2C_outside_view%2C_Montr%C3%A9al_2005-09-04.jpg",
    license: "CC BY-SA 3.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/3.0/",
  },
  "montreal-biosphere": {
    src: "/images/locations/montreal-biosphere.webp",
    photographer: "Ryan Hodnett",
    source: "https://commons.wikimedia.org/wiki/File:Montreal_Biosphere_-_Montreal%2C_Quebec_2019-05-11_(03).jpg",
    license: "CC BY-SA 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
  },
};
