<script setup lang="ts">
import { computed } from 'vue'
// A style wrapper to make npm badges do flex-row.
const props = defineProps<{
  packageName?: string
}>()

const shortName = computed(() => {
  if (!props.packageName) return ''
  const parts = props.packageName.split('/')
  return parts[parts.length - 1]
})
</script>

<template>
  <div class="flex flex-row items-center gap-1 pt-2">
    <a :href="`https://www.npmjs.com/package/${packageName}`">
      <img :src="`https://img.shields.io/npm/v/${packageName}.svg?style=flat-square`" alt="npm version">
    </a>
    <a :href="`https://github.com/wingshq/wings/blob/main/packages/${shortName}/CHANGELOG.md`">
      <img :src="`https://img.shields.io/badge/changelog-.md-blue.svg?style=flat-square`" alt="Changelog">
    </a>
  </div>
</template>

<style lang="postcss">
/* For npm and changelog badges */
.badges p {
  @apply flex flex-row;
}

.badges img {
  margin-right: .5em
}
</style>
