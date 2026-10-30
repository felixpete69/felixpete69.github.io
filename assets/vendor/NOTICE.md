# Animation dependencies and references

GSAP Core and ScrollTrigger 3.15.0 are distributed here without modification, from the official `gsap` npm package. Copyright 2026 GreenSock / Webflow; original license headers retained. Use is subject to the [GSAP Standard License](https://gsap.com/standard-license/).

The custom interactions in `motion.js` use GSAP directly. Tilt and magnetic-button interaction concepts were explored through [React Bits](https://github.com/DavidHDev/react-bits), specifically TiltedCard and Magnet. React Bits components are not bundled and React is not a runtime dependency of this site.

Implementation references: [official GSAP skills](https://github.com/greensock/gsap-skills), including gsap-core and gsap-scrolltrigger. Browser QA follows the interaction, screenshot and console-inspection approach in [webapp-testing](https://github.com/anthropics/skills/tree/main/skills/webapp-testing).
