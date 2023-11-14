# CS2 Items parser
Parsing game information about items, skins, agents and etc.

## Information
Using information from `scripts/items/items_game.txt` file (in vpk) and localization files (en, ru) generates information about skins, agents, stickers, etc. It also organizes images and saves information about the paths.

The following files are currently being generated:
* item_definitions - game items (including agents, as they are considered a separate item and not a skin)
* paintkits - skins and their basic parameters (some skins can be reapplied to different items)
* rarities - rarity of items and skins
* sticker_kits - stickers
* skins - relations of items and skins
* schema - items and skins applied to them

## Some useful
* Exported file format can be easily replaced [here](https://github.com/AspectUnk/cs2-items-parser/blob/ef5251562bf8680fd265826cf5d75faea452ca8c/index.js#L20)
* Most libraries for working with the vdf format have many problems, for example with comments. [vdf-parser](https://www.npmjs.com/package/vdf-parser) does not have this problem
