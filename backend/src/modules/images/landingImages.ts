/**
 * The landing stage's curation: a fixed set of Pixabay images, chosen once and
 * stored like any other. It is deliberately nothing to do with boards — the
 * hero is the front of the product, so what a person saves or makes public
 * must never change it. Explore is where the app's own content lives.
 *
 * The seed downloads these on first boot; the endpoint serves whichever are
 * stored, in this order, and the stage fills as many slots as it has images.
 */
export const LANDING_PROVIDER = 'pixabay' as const;

export const LANDING_IMAGE_IDS: readonly string[] = [
  // Tall, for the outer slots that travel furthest.
  '5913132', // Tokyo street, umbrellas and neon
  '10407209', // Desert dunes at golden hour
  '10266737', // Porcelain teapot on stone
  '4923094', // Wet city street, blue neon
  '10032445', // Sand ripples, minimal
  '5029691', // Lighthouse in a Baltic storm
  '4165342', // Seoul at night, signage
  '3713473', // Rain, umbrella, illuminated street
  // Wide, for the broad slots across the middle.
  '10273244', // Foggy forest at sunrise
  '8686902', // Lake and mist, golden
  '2297204', // Lake Louise, blue morning
  '5440720', // Matterhorn reflected
  '975091', // Pine forest in fog
  '5302291', // Conifers, Caucasus haze
  '8231248', // Lake, forest, cloud
  '10349715', // Autumn lake, still water
  // Interiors and craft, the quieter half of the stage.
  '1940174', // Kitchen interior, warm wood
  '2165756', // Kitchen, brown and low light
  '8980803', // Modern kitchen, wood
  '2400367', // Bright dining room
  '2556004', // Cactus on a kitchen window
  '4618917', // Hands at a potter's wheel
  '1139047', // Potter shaping a cup
  '10258355', // Vessel taking shape, Hanoi
  '2179091', // Stacked clay pots
  '64975', // Earthenware jugs
  '6568547', // Green tea and handmade teaware
  '820892', // Porcelain bowl
  // Architecture and coast, for contrast.
  '4917749', // Brutalist tower
  '5880149', // Concrete, monochrome
  '5880152', // Concrete and reflection
  '8785182', // Tide pool, Pacific Grove
  '4021254', // Mossy rocks, Oregon coast
  '5427649', // Anemone in a tide pool
  '4419861', // Beach and blue sky
  // A second ring for the stage, which reaches well past the screen.
  '5772125', // Tokyo streets, traffic at night
  '4807314', // Umbrella on a Tokyo street
  '4431082', // Night market, lit stalls
  '1547273', // Sunbeams through fog
  '5746604', // Foggy trees
  '4487292', // Mountain lake and a hut
  '8026824', // Clay on the wheel
  '4178215', // Chinaware, stacked
  '5641389', // Library, books to the ceiling
  '5880148', // Concrete, brutalist
  '6406047', // Rocks and coast
  '7150369', // Sahara dune
  '4538480', // Clouds over tidal sand, the one tall frame among the spares
];
