// Reuse the same complete creation, editing and pagination workflows.
const Tools = {
  render() {
    return `<div class="card" style="margin-bottom:16px;display:flex;gap:8px;"><button class="btn btn-ghost" onclick="App.validateProject()">Validate Project</button><button class="btn btn-ghost" onclick="Sidebar.navigate('pending')">Review Pending Changes</button><button class="btn btn-ghost" onclick="App.selectProject()">Change Project</button></div>${EntityBrowser.render()}`;
  },
  attach() {
    EntityBrowser.attach();
  },
  showCreateItem() {
    EntityBrowser.type = "Item";
    return EntityBrowser.showCreate();
  },
  showCreateSkill() {
    EntityBrowser.type = "Skill";
    return EntityBrowser.showCreate();
  },
  showCreateEntity() {
    return EntityBrowser.showCreate();
  },
};
