const fs = require("fs/promises");
const VDF = require("vdf-parser");
const _ = require("lodash");

const load_lang = async (path) => {
    const raw = await fs.readFile(path, { encoding: "utf8" });
    const tokens = VDF.parse(raw)?.lang?.Tokens;

    // hint: some keys have incorrect letter case
    let converted = {};

    for (const [key, values] of Object.entries(tokens)) {
        converted[key.toLowerCase()] = values;
    }

    return converted;
};

const save_readable = (path, json) => {
    return fs.writeFile(path, JSON.stringify(json, null, "\t"));
};

(async () => {
    const raw_items = await fs.readFile("input/items_game.txt", { encoding: "utf8" });
    const items = VDF.parse(raw_items)?.items_game;

    const lang_english = await load_lang("input/csgo_english.txt");
    const lang_russian = await load_lang("input/csgo_russian.txt");

    // item_definitions
    const prefabs = _.flatten(items.prefabs.map(Object.entries)).map(([prefab, obj]) => ({ ...obj, prefab }));
    const item_definitions = _.flatten(items.items.map(Object.entries))
        .map(([id, obj]) => {
            id = parseInt(id);

            if (_.isNaN(id))
                return null;

            if (!_.has(obj, "name") || !_.has(obj, "prefab"))
                return null;

            const prefab = prefabs.find(p => p?.prefab === obj?.prefab);
            if (!prefab)
                return null;

            const item_name = (obj?.item_name || prefab?.item_name)?.replace(/^#/g, "")?.toLowerCase();
            const item_desc = (obj?.item_description || prefab.item_description)?.replace(/^#/g, "")?.toLowerCase();

            const item_name_en = lang_english[item_name];
            const item_desc_en = lang_english[item_desc];

            const used_by_classes = obj?.used_by_classes || prefab?.used_by_classes;
            const stickers = obj?.stickers || prefab?.stickers;

            return {
                id,
                item_class: obj?.name,
                item_name: item_name,
                item_name_en,
                item_name_ru: lang_russian[item_name] || item_name_en,
                item_desc: item_desc,
                item_desc_en,
                item_desc_ru: lang_russian[item_desc] || item_desc_en,
                prefab: obj?.prefab,
                max_stickers: stickers ? Object.keys(stickers).length : undefined,
                used_by_classes: used_by_classes ? {
                    ct: used_by_classes?.["counter-terrorists"] == 1,
                    tt: used_by_classes?.terrorists == 1,
                } : undefined,
            };
        })
        .filter(d => d);

    await save_readable("output/item_definitions.json", item_definitions);

    // rarities
    const rarities = Object.entries(items.rarities)
        .map(([name, obj]) => {
            const loc_key = obj.loc_key?.replace(/^#/g, "")?.toLowerCase();
            const loc_key_weapon = obj.loc_key_weapon?.replace(/^#/g, "")?.toLowerCase();
            const loc_key_character = obj.loc_key_character?.replace(/^#/g, "")?.toLowerCase();

            const loc_key_en = lang_english[loc_key];
            const loc_key_weapon_en = lang_english[loc_key_weapon];
            const loc_key_character_en = lang_english[loc_key_character];

            return {
                name, ...obj,
                loc_key_en,
                loc_key_ru: lang_russian[loc_key] || loc_key_en,
                loc_key_weapon_en,
                loc_key_weapon_ru: lang_russian[loc_key_weapon] || loc_key_weapon_en,
                loc_key_character_en,
                loc_key_character_ru: lang_russian[loc_key_character] || loc_key_character_en,
                hex_color: items.colors[obj.color].hex_color,
            };
        })
        .filter(r => r.hex_color);

    await save_readable("output/rarities.json", rarities);

    // paintkits
    const paint_kits_rarity = _.merge(...items.paint_kits_rarity);
    const paint_kits = _.flatten(items.paint_kits.map(Object.entries))
        .map(([id, obj]) => {
            const description_string = obj.description_string?.replace(/^#/g, "")?.toLowerCase();
            const description_tag = obj.description_tag?.replace(/^#/g, "")?.toLowerCase();

            const description_string_en = lang_english[description_string];
            const description_tag_en = lang_english[description_tag];

            return {
                id: parseInt(id),
                rarity: paint_kits_rarity[obj.name],
                description_string_en,
                description_string_ru: lang_russian[description_string] || description_string_en,
                description_tag_en,
                description_tag_ru: lang_russian[description_tag] || description_tag_en,
                ...obj,
            };
        })
        .filter(r => !_.isNaN(r.id));

    await save_readable("output/paintkits.json", paint_kits);

    // skins
    const loot_lists = _.flatten(_.flatten(items.client_loot_lists.map(Object.values))
        .map(Object.keys));

    const item_sets = _.flatten(_.flatten(items.item_sets.map(Object.values))
        .map(set => set?.items)
        .map(Object.keys));

    // knife from icons
    const icons = Object.values(items.alternate_icons2.weapon_icons)
        .map(i => {
            const str = i.icon_path.replace(/_(light|medium|heavy)$/gi, "").split("/").pop();
            if (!str)
                return null;

            const item_class = item_definitions
                .sort((a, b) => b.item_class.length - a.item_class.length)
                .find(def => str?.startsWith(def.item_class))?.item_class;

            if (!item_class)
                return null;

            return `[${str.replace(`${item_class}_`, "")}]${item_class}`;
        });

    const skins = _.union(loot_lists, item_sets, icons)
        .map(data => {
            const group = /\[(.*)\](.*)/.exec(data);
            if (!group)
                return null;

            return {
                type: group[2],
                paintkit: group[1],
            }
        })
        .filter(_.isObject);

    await save_readable("output/skins.json", skins);

    const schema = item_definitions
        .map(item => ({
            item_definition_id: item.id,
            item_class: item.item_class,
            paintkits: skins
                .filter(skin => skin?.type == item?.item_class)
                .map(skin => skin.paintkit),
        }))
        .filter(item => item.paintkits.length > 0)
        .sort((a, b) => a.item_definition_id - b.item_definition_id);

    await save_readable("output/schema.json", schema);
})();