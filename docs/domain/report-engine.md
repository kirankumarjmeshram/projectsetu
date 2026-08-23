# Report engine

## Status

Report definitions, flexible section selections, report types, and generated-artifact references are implemented as contracts. PDF, DOCX, spreadsheet export, templates, and AI-assisted narrative are deferred.

Reports must consume typed, validated domain results and must not reimplement calculations. A report should retain enough version and source metadata to explain which formulas and scheme rules produced it. Generated customer reports are confidential artifacts and must not be committed to Git or exposed through public object URLs.

Future AI may draft narrative or explain deterministic values, but it must not invent, replace, or silently modify calculated values. Provider and rendering-library choices require ADRs before implementation.
