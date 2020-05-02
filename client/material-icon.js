/**
    @licence
    Copyright (c) 2017 Alan Chandler, all rights reserved

    This file is part of PASv5, an implementation of the Patient Administration
    System used to support Accuvision's Laser Eye Clinics.

    PASv5 is licenced to Accuvision (and its successors in interest) free of royality payments
    and in perpetuity in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the
    implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. Accuvision
    may modify, or employ an outside party to modify, any of the software provided that
    this modified software is only used as part of Accuvision's internal business processes.

    The software may be run on either Accuvision's own computers or on external computing
    facilities provided by a third party, provided that the software remains soley for use
    by Accuvision (or by potential or existing customers in interacting with Accuvision).
*/
/*
    `<pas-icon>` Provides the ability to ask for a position for a label set,
      and then calls the appropriate pdf routine with the correct params

*/

import { LitElement, html } from '../lit/lit-element.js';

const link = document.createElement('link');
link.rel = 'stylesheet';
link.type = 'text/css';
link.crossOrigin = 'anonymous';
//eslint-disable-next-line max-len
link.href =  'https://fonts.googleapis.com/icon?family=Material+Icons';
document.head.appendChild(link);

class MaterialIcon extends LitElement {
  render() {
    return html`
    <style>
      :host{
        font-family:"Material Icons";
        font-weight:normal;
        font-style:normal;
        font-size:var(--icon-size, 24px);
        line-height:1;
        letter-spacing:
        normal;
        text-transform:none;
        display:inline-block;
        white-space:nowrap;
        word-wrap:normal;
        direction:ltr;
        font-feature-settings:'liga';
        -webkit-font-smoothing:antialiased;
      }
    </style>
    <slot></slot>
    `;
  }
}
customElements.define('material-icon', MaterialIcon);
