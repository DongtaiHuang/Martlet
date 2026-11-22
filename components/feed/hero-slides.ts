import artsBuilding from "./campus-banner.webp";
import roddickGates from "./hero/roddick-gates.webp";
import redpathMuseum from "./hero/redpath-museum.webp";
import lowerCampus from "./hero/lower-campus.webp";

export const heroSlides = [
  {
    image: artsBuilding,
    alt: "Students outside McGill’s Arts Building on the downtown campus",
    position: "object-[50%_20%]",
    photographer: "D. Benjamin Miller",
    source: "https://commons.wikimedia.org/wiki/File:Arts_Building,_McGill_University,_Aug_31_2022.jpg",
    title: "Meet up at McGill",
    description: "Find your people. Create spontaneous meetups, grab coffee, study together, and make new friends.",
    actions: [
      { label: "Create Meetup", href: "/meetups/new" },
      { label: "Browse Meetups", href: "/meetups#meetup-feed" },
    ],
  },
  {
    image: roddickGates,
    alt: "Roddick Gates framing the walkway into McGill’s downtown campus",
    position: "object-[50%_58%]",
    photographer: "D. Benjamin Miller",
    source: "https://commons.wikimedia.org/wiki/File:Roddick_Gates,_December_18,_2023.jpg",
    title: "Explore Your Campus",
    description: "Discover spontaneous meetups and exciting places around McGill through our interactive map.",
    actions: [{ label: "Explore Map", href: "/explore" }],
  },
  {
    image: redpathMuseum,
    alt: "The stone columns and red banners at the entrance to McGill’s Redpath Museum",
    position: "object-[50%_26%]",
    photographer: "Daderot",
    source: "https://commons.wikimedia.org/wiki/File:Redpath_Museum_-_McGill_University_-_Montreal,_Canada_-_DSC07739.jpg",
    title: "Every Place Has a Story",
    description: "Explore iconic landmarks, complete photo challenges, and unlock memories shared by other students.",
    actions: [{ label: "Discover Landmarks", href: "/landmarks" }],
  },
  {
    image: lowerCampus,
    alt: "Students relaxing on McGill’s lower campus lawn with the Montréal skyline behind them",
    position: "object-[50%_73%]",
    photographer: "Daderot",
    source: "https://commons.wikimedia.org/wiki/File:Lawn_-_McGill_University_-_Montreal,_Canada_-_DSC08283.jpg",
    title: "Meet Your Martlet",
    description: "Customize your own 3D Martlet, express yourself, and unlock accessories through your campus adventures.",
    actions: [{ label: "Customize Avatar", href: "/avatar" }],
  },
] as const;

// All four were released under CC0 1.0. Local files are resized WebPs with responsive cropping.
export const heroPhotoLicense = "CC0 1.0";
