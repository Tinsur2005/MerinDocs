<script setup>
import { siteConfig } from '../siteConfig';

const year = new Date().getFullYear();
</script>

<template>
  <footer class="app-footer">
    <div class="app-footer-inner">
      Copyright © {{ year }}
      <a
        v-if="siteConfig.footer.copyrightText"
        :href="siteConfig.footer.copyrightUrl || '#'"
        target="_blank"
        rel="noopener"
        style="color:var(--color-text-secondary);text-decoration:none;"
      >{{ siteConfig.footer.copyrightText }}</a>
      All rights reserved
      <br />
      Powered By
      <a
        v-if="siteConfig.footer.poweredByText"
        class="footer-link"
        :href="siteConfig.footer.poweredByUrl || '#'"
        target="_blank"
        rel="noopener"
      >{{ siteConfig.footer.poweredByText }}</a>

      <div
        v-if="siteConfig.footer.beian.icpText || siteConfig.footer.beian.gonganText"
        class="footer-beian"
      >
        <a
          v-if="siteConfig.footer.beian.icpText"
          class="beian-ico"
          target="_blank"
          :href="siteConfig.footer.beian.icpUrl || 'https://beian.miit.gov.cn/'"
          rel="nofollow"
          :title="siteConfig.footer.beian.icpText"
        >{{ siteConfig.footer.beian.icpText }}</a>
        <a
          v-if="siteConfig.footer.beian.gonganText"
          :href="siteConfig.footer.beian.gonganUrl || '#'"
          rel="noreferrer"
          target="_blank"
        >
          <img
            v-if="siteConfig.footer.beian.gonganIcon"
            :src="siteConfig.footer.beian.gonganIcon"
            alt="公安备案图标"
            style="width:15px;height:auto;vertical-align:middle;margin:0 4px;"
          >
          {{ siteConfig.footer.beian.gonganText }}
        </a>
      </div>
    </div>
  </footer>
</template>
