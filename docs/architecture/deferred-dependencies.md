# Deferred dependency upgrades

Major versions left behind on purpose, and what blocks each one, so a dependency pass does not redo the analysis.

## croner (stays on 9)

croner 10 and later refuse a step with a numeric prefix (`15/20`: "stepping with numeric prefix is not allowed").
`toCRON()` in `shared/runs.ts` builds exactly that for every field with a step (`minute/minuteStep`, and the same
for hour, day of month and month), so every stepped scheduling would fail when its next run is computed.

The upgrade needs `toCRON()` rewritten with a range, `<start>-<max>/<step>` (`15-59/20` fires at 15, 35, 55),
never `*/<step>` (`*/20` fires at 0, 20, 40 and would shift the stored schedulings). The UI also feeds the
expression to cronstrue for its description. Outside this syntax error, croner 10 only differs on the ambiguous
hour of the autumn DST change, which it resolves to summer time. Do it in a dedicated change, not in a
dependency pass.

## @vueuse/core (stays on 14)

`@data-fair/lib-vuetify` 2.5 depends on `@vueuse/core ^14`: moving the ui to 15 would install the package
twice. Keep it as a direct dependency of the ui anyway, since `@data-fair/lib-vue` declares it as an optional
peer.

## mongodb (stays on 6)

Driver major, not evaluated yet.

## nodemon

nodemon 3.1.14 ships minimatch 10, reported with a moderate vulnerability. Dev only, no upstream fix.
