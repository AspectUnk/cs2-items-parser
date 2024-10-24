const fs = require("fs/promises");
const path = require("path");
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

const copy_images = async (files) => {
    for (const file of files) {
        if (!file)
            continue;

        try {
            const output = `output/images/${file.replace(/(_medium)*_large$/gi, "")}.png`;
            await fs.mkdir(path.dirname(output), { recursive: true });
            await fs.copyFile(`input/images/${file}_png.png`, output);
        } catch { }
    }
};

(async () => {
    const raw_items = await fs.readFile("input/items_game.txt", { encoding: "utf8" });
    const items = VDF.parse(raw_items)?.items_game;

    const lang_english = await load_lang("input/csgo_english.txt");
    const lang_russian = await load_lang("input/csgo_russian.txt");

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
                image: obj?.image_inventory,
                max_stickers: stickers ? Object.keys(stickers).length : undefined,
                used_by_classes: used_by_classes ? {
                    ct: used_by_classes?.["counter-terrorists"] == 1,
                    tt: used_by_classes?.terrorists == 1,
                } : undefined,
            };
        })
        .filter(d => d && d?.item_name_en);

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

    // stickers
    const sticker_kits = _.flatten(items.sticker_kits.map(Object.entries))
        .map(([id, obj]) => {
            const item_name = obj.item_name?.replace(/^#/g, "")?.toLowerCase();
            const description_string = obj.description_string?.replace(/^#/g, "")?.toLowerCase();

            const item_name_en = lang_english[item_name];
            const description_string_en = lang_english[description_string];

            return {
                id: parseInt(id),
                name: obj.name,
                rarity: obj?.rarity,
                item_name,
                item_name_en,
                item_name_ru: lang_russian[item_name] || item_name_en,
                description_string,
                description_string_en,
                description_string_ru: lang_russian[description_string] || description_string_en,
                sticker_image: obj?.sticker_material ? `econ/stickers/${obj.sticker_material}` : undefined,
            };
        });

    await copy_images(sticker_kits.filter(i => i?.sticker_image).map(i => `${i}_large`));
    await save_readable("output/sticker_kits.json", sticker_kits);

    // keychains
    const keychain_definitions = Object.entries(items.keychain_definitions)
        .map(([id, obj]) => {
            id = parseInt(id);

            if (_.isNaN(id))
                return null;

            const item_name = obj?.loc_name?.replace(/^#/g, "")?.toLowerCase();
            const item_desc = obj?.loc_description?.replace(/^#/g, "")?.toLowerCase();

            const item_name_en = lang_english[item_name];
            const item_desc_en = lang_english[item_desc];

            return {
                id,
                name: obj?.name,
                rarity: obj?.rarity,
                item_name,
                item_name: item_name,
                item_name_en,
                item_name_ru: lang_russian[item_name] || item_name_en,
                item_desc: item_desc,
                item_desc_en,
                item_desc_ru: lang_russian[item_desc] || item_desc_en,
                image: obj?.image_inventory,
                pedestal_model: obj?.pedestal_display_model,
            };
        });

    await copy_images(keychain_definitions.filter(i => i?.image).map(i => i?.image));
    await save_readable("output/keychain_definitions.json", keychain_definitions);

    // skins
    const loot_lists = _.flatten(_.flatten(items.client_loot_lists.map(Object.values))
        .map(Object.keys));

    const item_sets = _.flatten(_.flatten(items.item_sets.map(Object.values))
        .map(set => set?.items)
        .map(Object.keys));

    // knife from icons
    const icons = Object.values(items.alternate_icons2.weapon_icons).map(i => i.icon_path);
    const knife_icons = icons
        .map(i => {
            const str = i.replace(/_(light|medium|heavy)$/gi, "").split("/").pop();
            if (!str)
                return null;

            const item_class = item_definitions
                .sort((a, b) => b.item_class.length - a.item_class.length)
                .find(def => str?.startsWith(def.item_class))?.item_class;

            if (!item_class)
                return null;

            return `[${str.replace(`${item_class}_`, "")}]${item_class}`;
        });

    const skins = _.union(loot_lists, item_sets, knife_icons)
        .map(data => {
            const group = /\[(.*)\](.*)/.exec(data);
            if (!group)
                return null;

            return {
                type: group[2],
                kit: group[1],
            }
        })
        .filter(_.isObject);

    const skins_images = skins
        .map(skin => {
            const re = new RegExp(`${skin.type}_${skin.kit}_medium$`);
            return `${icons.find(i => re.test(i))}_large`;
        })
        .filter(s => s);

    await copy_images(skins_images);
    await save_readable("output/skins.json", skins);

    const schema = item_definitions
        .filter(item => item.item_name_en)
        .map(item => {
            const kits = skins
                .filter(skin => skin?.type == item?.item_class)
                .map(skin => skin.kit);

            const item_paint_kits = kits.filter(kit => paint_kits.findIndex(paint => kit === paint.name) >= 0);
            const item_sticker_kits = kits.filter(kit => sticker_kits.findIndex(sticker => kit === sticker.name) >= 0);

            return {
                item_definition_id: item.id,
                item_class: item.item_class,
                image: item?.image,
                paint_kits: item_paint_kits.length > 0 ? item_paint_kits : undefined,
                sticker_kits: item_sticker_kits.length > 0 ? item_sticker_kits : undefined,
            };
        })
        .filter(item => item?.paint_kits?.length > 0 || item?.sticker_kits?.length > 0 || item.item_class.startsWith("customplayer"))
        .sort((a, b) => a.item_definition_id - b.item_definition_id);

    await copy_images(schema.map(i => i?.image));
    await save_readable("output/schema.json", schema);
})();