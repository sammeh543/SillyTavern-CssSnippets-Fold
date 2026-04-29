import { saveSettingsDebounced } from '../../../../../script.js';
import { extension_settings } from '../../../../extensions.js';
import { delay } from '../../../../utils.js';
import { Folder } from './Folder.js';
import { Snippet } from './Snippet.js';
import { BaseSetting } from './settings/BaseSetting.js';
import { NumberSetting } from './settings/NumberSetting.js';

export class Settings {
    static from(props) {
        const inst = Object.assign(new Settings(), props);
        inst.snippetList = (props.snippetList ?? []).map(it=>Snippet.from(inst, it, props));
        inst.folderList = (props.folderList ?? []).map(it=>Folder.from(it));
        return inst;
    }




    /**@type {number}*/ watchInterval = 500;

    /**@type {Snippet[]}*/ snippetList = [];
    /**@type {Folder[]}*/ folderList = [];
    /**@type {{[index:string]:string[]}}*/ themeSnippets = {};
    /**@type {{[index:string]:boolean}}*/ filters = {};

    /**@type {BaseSetting[]}*/ settingList = [];


    /**@type {HTMLElement}*/ dom;
    /**@type {HTMLElement}*/ parent;

    /**@type {()=>void}*/ onCssChanged;




    constructor() {
        Object.assign(this, extension_settings.cssSnippets);
        this.registerSettings();
        this.init();
    }


    toJSON() {
        return {
            watchInterval: this.watchInterval,
            snippetList: this.snippetList,
            folderList: this.folderList,
            themeSnippets: this.themeSnippets,
            filters: this.filters,
        };
    }


    save() {
        saveSettingsDebounced();
        this.onCssChanged?.();
    }

    getSynced() {
        const data = JSON.parse(localStorage.getItem('csss--syncedList') ?? '[]');
        return data;
    }
    setSynced(data) {
        localStorage.setItem('csss--syncedList', JSON.stringify(data));
    }


    registerSettings() {
        // external editor
        {
            this.settingList.push(NumberSetting.fromProps({ id: 'csss--watchInterval',
                name: 'Watch Interval',
                description: 'Time to wait between checking CSS edited in external editor for changes in milliseconds.',
                min: 1,
                max: 5000,
                step: 1,
                category: ['External Editor'],
                initialValue: this.watchInterval,
                onChange: (it)=>{
                    this.watchInterval = it.value;
                    this.save();
                },
            }));
        }
    }




    async init() {
        const response = await fetch('/scripts/extensions/third-party/SillyTavern-CssSnippets/html/settings.html');
        if (!response.ok) {
            return console.warn('failed to fetch template: csss--settings.html');
        }
        const settingsTpl = document
            .createRange()
            .createContextualFragment(await response.text())
            .querySelector('#csss--settings-v2')
        ;
        const dom = /**@type {HTMLElement} */(settingsTpl.cloneNode(true));
        this.dom = dom;

        dom.querySelector('#csss--settings-close').addEventListener('click', ()=>{
            this.hide();
        });
        dom.querySelector('.contentWrapper').addEventListener('scroll', ()=>this.updateCategory());

        const search = dom.querySelector('.search');
        search.addEventListener('input', ()=>{
            const query = search.value.trim().toLowerCase();
            for (const setting of this.settingList) {
                if (setting.name.toLowerCase().includes(query) || setting.description.toLowerCase().includes(query)) {
                    setting.dom.classList.remove('hidden');
                } else {
                    setting.dom.classList.add('hidden');
                }
            }
            const cats = [...dom.querySelectorAll('.contentWrapper .category:has(.item:not(.hidden)) > .head')].map(it=>it.textContent);
            const heads = [...dom.querySelectorAll('.categoriesWrapper .category .head')];
            for (const head of heads) {
                if (cats.includes(head.textContent)) {
                    head.classList.remove('hidden');
                } else {
                    head.classList.add('hidden');
                }
            }
            this.updateCategory();
        });

        // build tree
        const tree = {};
        for (const setting of this.settingList) {
            let cur = tree;
            for (const key of setting.category) {
                if (!cur[key]) {
                    cur[key] = { name:key, settings:[] };
                }
                cur = cur[key];
            }
            cur.settings.push(setting);
        }

        // render tree
        const catRoot = /**@type {HTMLElement}*/(dom.querySelector('.categoriesWrapper'));
        const contRoot = /**@type {HTMLElement}*/(dom.querySelector('.contentWrapper'));
        const render = (cat, cont, cur, level = 0)=>{
            for (const key of Object.keys(cur)) {
                if (['name', 'settings'].includes(key)) continue;
                const curCat = cur[key];
                const block = document.createElement('div'); {
                    block.classList.add('category');
                    const head = document.createElement('div'); {
                        head.classList.add('head');
                        head.setAttribute('data-level', level.toString());
                        head.textContent = key;
                        block.append(head);
                    }
                }
                const catBlock = /**@type {HTMLElement}*/(block.cloneNode(true));
                catBlock.querySelector('.head').addEventListener('click', ()=>{
                    let offset = 0;
                    let head = /**@type {HTMLElement}*/(block.querySelector('.head'));
                    head = head.closest('.category').parentElement.closest('.category')?.querySelector('.head');
                    while (head) {
                        offset += head.offsetHeight;
                        head = head.closest('.category').parentElement.closest('.category')?.querySelector('.head');
                    }
                    contRoot.scrollTo({
                        top: block.offsetTop - offset,
                        behavior: 'smooth',
                    });
                });
                cat.append(catBlock);
                cont.append(block);
                for (const setting of curCat.settings) {
                    const item = setting.render();
                    block.append(item);
                }
                render(catBlock, block, curCat, level + 1);
            }
        };
        render(catRoot, contRoot, tree);
    }


    updateCategory() {
        const wrapRect = this.dom.querySelector('.contentWrapper').getBoundingClientRect();
        for (const setting of this.settingList) {
            const rect = setting.dom.getBoundingClientRect();
            if (rect.top > wrapRect.top || rect.top < wrapRect.top && rect.bottom > wrapRect.top + wrapRect.height / 4) {
                const cat = setting.dom.closest('.category').querySelector('.head').textContent;
                const heads = [...this.dom.querySelectorAll('.categoriesWrapper .head')];
                for (const head of heads) {
                    if (head.textContent == cat) {
                        let cur = head;
                        cur.classList.add('current');
                        while (cur) {
                            cur = cur.closest('.category').parentElement.closest('.category')?.querySelector('.head');
                            cur?.classList?.add('current');
                        }
                    } else {
                        head.classList.remove('current');
                    }
                }
                return;
            }
        }
    }

    async show(parent) {
        if (this.parent != parent) {
            this.parent = parent;
            parent.addEventListener('keydown', (evt)=>{
                if (!this.dom.classList.contains('csss--active')) return;
                const query = this.dom.querySelector('.search');
                const rect = query.getBoundingClientRect();
                if (document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2) != query) return;
                if (evt.ctrlKey && evt.key == 'f') {
                    evt.preventDefault();
                    evt.stopPropagation();
                    this.dom.querySelector('.search').select();
                }
            });
        }
        parent.append(this.dom);
        this.dom.classList.add('csss--active');
        await delay(200);
        this.updateCategory();
        this.dom.querySelector('.search').select();
    }
    hide() {
        this.dom.classList.remove('csss--active');
        this.dom.remove();
    }
    async toggle(parent) {
        if (this.dom.classList.contains('csss--active')) {
            this.hide();
        } else {
            await this.show(parent);
        }
    }
}
