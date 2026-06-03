# Historic NBC snow factors (`data/code-editions.json`)

The reserve engine compares historic capacity (construction era) to current demand (NBC 2015 snow formula + Commentary L on the current side).

## What `snowLoadFactor` means here

For a site built in year *Y*, we use:

```
historic_Ss = Table_C-2_Ss × snowLoadFactor(Y)
```

then run the same NBC 2015 §4.1.6.2 formula (Cb, Cw, Cs, Ca) on `historic_Ss`. This is a screening shortcut: one factor per era instead of re-implementing every past code edition.

## Basis (qualitative)

| Era | Factor | Rationale |
|-----|--------|-----------|
| NBC 1953 and earlier | 1.00 | Design snow load often taken as ground snow load. |
| NBC 1960–1965 | 0.80 | NRC national roof snow survey → basic roof coefficient ≈ 80% of ground. |
| NBC 1970–1985 | 0.82–0.90 | Incremental map and coefficient refinements. |
| NBC 1990 | 0.92 | Formal Ss / Sr split; 30-year ground snow period. |
| NBC 1995–2005 | 0.96–0.98 | Move to 50-year return period and revised Cb for large roofs. |
| NBC 2010+ | 1.00 | Same climatic table family as current PCIC NBCC columns. |

References: NRC progress reports on roof snow loads (e.g. 1964–65 ninth progress report); structural engineering summaries of NBCC snow evolution.

## Not yet in this file

- Per-province adoption dates (Quebec, BC acts, etc.)
- Separate historic **Cb / Cw / Cs** by era (only a single Ss scaler today)
- Digitized values from each edition’s Appendix C tables

Confirm these factors with a Structural Engineer before using.