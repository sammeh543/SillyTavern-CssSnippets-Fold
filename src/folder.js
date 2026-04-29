import { uuidv4 } from '../../../../utils.js';

export class Folder {
    /**
     * @param {object} props
     * @returns {Folder}
     */
    static from(props) {
        return Object.assign(new this(), props);
    }

    /**@type {string}*/ id;
    /**@type {string}*/ name = 'New Folder';
    /**@type {boolean}*/ isCollapsed = false;
    /**@type {string[]}*/ snippetIds = [];

    /**@type {HTMLElement}*/ li;

    constructor() {
        this.id = uuidv4();
    }

    toJSON() {
        return {
            id: this.id,
            name: this.name,
            isCollapsed: this.isCollapsed,
            snippetIds: this.snippetIds,
        };
    }
}
