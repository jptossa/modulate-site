# Source data

Raw downloads live here and are git-ignored (`/data/` in `.gitignore`, except this file). Re-create them with the steps below.

## O*NET 31.0 (occupations, skills, knowledge)

- Source: https://www.onetcenter.org/dl_files/database/db_31_0_text.zip (13,183,034 bytes, August 2026 release)
- Put the zip in `data/onet-31-0/raw/`, extract it to `data/onet-31-0/extracted/` so the files are in `data/onet-31-0/extracted/db_31_0_text/`.
- License: CC BY 4.0. Attribution required: "O*NET 31.0 Database by the U.S. Department of Labor, Employment and Training Administration (USDOL/ETA). Used under the CC BY 4.0 license." Changes made: skills are normalised and averaged per SOC code.
- Load: `node --env-file=.env scripts/ingest/onet.mjs`

## O*NET Military Crosswalk (military codes to civilian roles)

- Source: https://onetcenter.org/dl_files/2019/military_crosswalk.zip (4,826,815 bytes; the O*NET crosswalks page labels it "updated August 2024", and the file inside is `milx0724.csv`). Built on the Defense Manpower Data Center MOC crosswalk. Also lists O*NET's other crosswalks at https://onetcenter.org/crosswalks.html.
- Put the zip in `data/onet-military/raw/`, extract it to `data/onet-military/extracted/` so the files are in `data/onet-military/extracted/military_crosswalk/` (`milx0724.csv`, `.xlsx`, `.accdb` and a `Read Me.pdf` describing the columns). The loader reads the CSV: the XLSX would turn codes such as Marine `0311` into numbers.
- License: CC BY 4.0. Attribution: "Military Crosswalk by the U.S. Department of Labor, Employment and Training Administration (USDOL/ETA). Used under the CC BY 4.0 license." Changes made: only codes linked to roles in the `occupations` table are kept, and O*NET-SOC detail codes are folded into their 6-digit SOC.
- What loads: Army, Navy, Air Force, Marine Corps, Coast Guard and Space Force occupational codes (service letters A J Q N P S V F X Y Z M C H L O U; OPM, DoD and NSPS codes are skipped). A code has an active and a retired record when a service reuses it; the active one wins, and a code with only retired records is kept and flagged inactive. Codes O*NET links only to roles we do not carry (military-only jobs such as Infantry) are kept with no roles and the O*NET titles in `other_links`.
- Not loaded: the COOL and ASVAB supplemental files (`cool_supplemental_data.xlsx`, `citm_supplemental_data.xlsx` in the same `dl_files/2019/` folder).
- Run migration `20261030000000_military_crosswalk.sql` first, then `npm run ingest:military` (add `-- --dry-run` first; it only reads the `occupations` table).

## BLS (projections and pay)

bls.gov blocks scripted downloads, so download these in a browser into `data/bls/`:
- `occupation.xlsx` from https://www.bls.gov/emp/ind-occ-matrix/occupation.xlsx (Employment Projections)
- `oesm19nat.zip` … `oesm25nat.zip` from https://www.bls.gov/oes/special-requests/oesm<YY>nat.zip (OEWS May 2019–2025 national estimates). Extract each into `data/bls/oews-20YY/` (the zip's own folder `oesmYYnat/` stays inside).
- Load projections: `npm run ingest:bls`. Load annual history: `npm run ingest:oews`.
- Local estimates (states, metropolitan and nonmetropolitan areas), May 2025 only: `oesm25st.zip` and `oesm25ma.zip` from https://www.bls.gov/oes/special-requests/ (same pattern as above). Both are linked as "XLSX" from https://www.bls.gov/oes/tables.htm (May 2025 section). Extract into `data/bls/oews-2025/`; each zip unpacks into a folder of its own name (`oesm25st/oesm25st/state_M2025_dl.xlsx`, `oesm25ma/oesm25ma/MSA_M2025_dl.xlsx` and `BOS_M2025_dl.xlsx` for nonmetropolitan areas), which the script finds on its own. Load: `npm run ingest:areas` (add `-- --dry-run` first).
- The BLS public API only holds the latest OEWS year, so history comes from these files. BLS does not encourage OEWS for time-series use (pooled panels; method changes in 2021 and 2022; weak 2020–21 response), so label the lines "annual estimates". Series with a 40%+ one-year swing are left out.
