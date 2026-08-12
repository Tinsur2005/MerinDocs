<script setup>
const year = new Date().getFullYear();
</script>

<template>
  <footer class="app-footer">
    <div class="app-footer-inner">
      Copyright © {{ year }}
      <a
        href="https://www.tinsur.cn/merindocs"
        target="_blank"
        style="color:#666;text-decoration:none;"
      >Tinsur</a>
      All rights reserved
      <br />
      Powered By MerinDocs文档系统
    </div>
  </footer>
</template>
