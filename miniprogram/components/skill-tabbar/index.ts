Component({
  properties: {
    active: {
      type: String,
      value: "home",
    },
  },

  methods: {
    onTapHome() {
      if (this.data.active === "home") return;
      wx.redirectTo({ url: "/pages/home/index" });
    },

    onTapExplore() {
      if (this.data.active === "explore") return;
      wx.redirectTo({ url: "/pages/explore/index" });
    },

    onTapFavorites() {
      if (this.data.active === "favorites") return;
      wx.redirectTo({ url: "/pages/favorites/index" });
    },
  },
});
