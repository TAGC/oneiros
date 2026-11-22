# Wiki links

| Syntax                     | Links to                                   |
| -------------------------- | ------------------------------------------ |
| `[[Echo]]`                 | the Echo page, shown as "Echo"             |
| `[[Memory\|memories]]`     | the Memory page, shown as "memories"       |
| `[[Coherence#At zero]]`    | a section of the Coherence page            |
| `[[Coherence#At zero\|x]]` | that section, shown as "x"                 |
| `[[#Coherence status]]`    | a section of the current page              |

(The `\|` above is only escaped because it sits in a table; write a plain `|` in prose. Inside a Markdown table, escape it as `\|`.)

Targets match titles and aliases, ignoring case. A link to a page that does not exist yet shows red and points at the page's would-be URL. When the page is written, it turns blue. Prefer linking the canonical title with a label (`[[Belief|beliefs]]`) until the target page exists, then add plurals as aliases.

Links inside raw HTML (such as `<p class="formula">`) are not processed.
