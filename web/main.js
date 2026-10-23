(function () {
  "use strict";
  const API_BASE = (window.EVENTOS_API_URL || "http://localhost:3000").replace(/\/$/, "");
  const SESSION_KEY = "eventos.usuario";
  const $ = function (selector, root) { return (root || document).querySelector(selector); };
  const loginView = $("#loginView");
  const appView = $("#appView");
  const loginForm = $("#loginForm");
  const loginMessage = $("#loginMessage");
  const loginSubmit = $("#loginSubmit");
  const passwordInput = $("#password");
  const eventDialog = $("#eventDialog");
  const eventForm = $("#eventForm");
  const eventRows = $("#eventRows");
  const tableState = $("#tableState");
  const tableStateTitle = $("#tableStateTitle");
  const tableStateText = $("#tableStateText");
  const retryEventsButton = $("#retryEventsButton");
  const typeFilter = $("#typeFilter");
  const eventSearch = $("#eventSearch");
  let currentUser = null;
  let events = [];
  let editingEvent = null;
  let toastTimer = null;

  function escapeHTML(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (character) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character];
    });
  }

  async function api(path, options) {
    const config = Object.assign({ method: "GET", headers: { "Content-Type": "application/json" } }, options || {});
    const response = await fetch(API_BASE + path, config);
    const contentType = response.headers.get("content-type") || "";
    const data = contentType.includes("application/json") ? await response.json() : null;
    if (!response.ok) throw new Error((data && (data.message || data.error)) || "Não foi possível concluir a solicitação.");
    return data;
  }

  function setLoginMessage(message, isError) {
    loginMessage.textContent = message || "";
    loginMessage.hidden = !message;
    loginMessage.classList.toggle("is-error", Boolean(isError));
    loginMessage.classList.toggle("is-success", Boolean(message) && !isError);
  }

  function showLogin() {
    appView.hidden = true;
    loginView.hidden = false;
    currentUser = null;
  }

  function showApp(user) {
    currentUser = user;
    loginView.hidden = true;
    appView.hidden = false;
    $("#loggedUserName").textContent = user.nome || user.email || "Usuário";
    const parts = String(user.nome || user.email || "U").trim().split(/\s+/);
    $("#userAvatar").textContent = (parts[0].charAt(0) + (parts[1] ? parts[1].charAt(0) : "")).toUpperCase();

    loadEvents();
  }

  function restoreSession() {
    try {
      const savedUser = JSON.parse(sessionStorage.getItem(SESSION_KEY) || "null");
      if (savedUser && savedUser.id && (savedUser.nome || savedUser.email)) {
        showApp(savedUser);
        return;
      }
    } catch (error) {
      sessionStorage.removeItem(SESSION_KEY);
    }
    showLogin();
  }

  loginForm.addEventListener("submit", async function (event) {
    event.preventDefault();
    setLoginMessage("");
    if (!loginForm.reportValidity()) return;
    const email = $("#email").value.trim().toLowerCase();
    const password = passwordInput.value;
    loginSubmit.disabled = true;
    loginSubmit.querySelector("span").textContent = "Entrando...";
    try {
      const users = await api("/usuario/listar");
      const user = Array.isArray(users) && users.find(function (candidate) {
        return String(candidate.email || "").trim().toLowerCase() === email && candidate.senha === password;
      });
      if (!user) {
        setLoginMessage("E-mail ou senha inválidos. Confira seus dados e tente novamente.", true);
        return;
      }
      const safeUser = { id: user.id, nome: user.nome, email: user.email };
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(safeUser));
      loginForm.reset();
      showApp(safeUser);
    } catch (error) {
      setLoginMessage("Não foi possível conectar ao servidor. Verifique se a API está em execução e tente novamente.", true);
    } finally {
      loginSubmit.disabled = false;
      loginSubmit.querySelector("span").textContent = "Entrar";
    }
  });

  $("#togglePassword").addEventListener("click", function () {
    const visible = passwordInput.type === "text";
    passwordInput.type = visible ? "password" : "text";
    this.setAttribute("aria-label", visible ? "Mostrar senha" : "Ocultar senha");
    this.title = visible ? "Mostrar senha" : "Ocultar senha";
    passwordInput.focus();
  });

  $("#logoutButton").addEventListener("click", function () {
    sessionStorage.removeItem(SESSION_KEY);
    eventSearch.value = "";
    typeFilter.value = "";
    showLogin();
    setLoginMessage("");
    $("#email").focus();
  });

  function setTableState(title, description, showRetry) {
    tableStateTitle.textContent = title;
    tableStateText.textContent = description || "";
    tableState.hidden = false;
    retryEventsButton.hidden = !showRetry;
  }

  function formatDate(value) {
    if (!value) return "Data não informada";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Data não informada";
    return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric" }).format(date);
  }

  function formatTemperature(value) {
    if (value === null || value === undefined || value === "") return "—";
    const number = Number(value);
    if (Number.isNaN(number)) return "—";
    return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(number) + "°C";
  }

  function typeClass(type) {
    const normalized = String(type || "").toLocaleLowerCase("pt-BR");
    if (normalized.includes("tempest") || normalized.includes("chuva") || normalized.includes("enchente")) return "type-blue";
    if (normalized.includes("seca") || normalized.includes("umidade") || normalized.includes("queimada") || normalized.includes("calor")) return "type-orange";
    if (normalized.includes("geada") || normalized.includes("frio")) return "type-violet";
    return "type-teal";
  }

  function updateTypeFilter() {
    const selected = typeFilter.value;
    const uniqueTypes = Array.from(new Set(events.map(function (item) { return item.tipoEvento; }).filter(Boolean)))
      .sort(function (a, b) { return a.localeCompare(b, "pt-BR"); });
    typeFilter.innerHTML = '<option value="">Todos os tipos</option>' + uniqueTypes.map(function (type) {
      return '<option value="' + escapeHTML(type) + '">' + escapeHTML(type) + "</option>";
    }).join("");
    if (uniqueTypes.includes(selected)) typeFilter.value = selected;
  }

  function filteredEvents() {
    const query = eventSearch.value.trim().toLocaleLowerCase("pt-BR");
    const selectedType = typeFilter.value;
    return events.filter(function (item) {
      const matchesType = !selectedType || item.tipoEvento === selectedType;
      const searchable = [item.cidade, item.tipoEvento, item.nivelImpacto].join(" ").toLocaleLowerCase("pt-BR");
      return matchesType && (!query || searchable.includes(query));
    }).sort(function (a, b) { return new Date(b.data || 0).getTime() - new Date(a.data || 0).getTime(); });
  }

  function renderEvents() {

    updateTypeFilter();
    const visibleEvents = filteredEvents();
    $("#eventCountPill").textContent = visibleEvents.length + (visibleEvents.length === 1 ? " registro" : " registros");
    $("#eventsFooterCount").textContent = events.length + (events.length === 1 ? " evento" : " eventos");
    if (!events.length) {
      eventRows.innerHTML = "";
      setTableState("Nenhum evento registrado", "Comece adicionando o primeiro evento climático.", false);
      return;
    }
    if (!visibleEvents.length) {
      eventRows.innerHTML = "";
      setTableState("Nenhum resultado encontrado", "Tente alterar a busca ou o filtro selecionado.", false);
      return;
    }
    tableState.hidden = true;
    eventRows.innerHTML = visibleEvents.map(function (item) {
      const id = Number(item.id);
      const type = escapeHTML(item.tipoEvento || "Evento climático");
      const city = escapeHTML(item.cidade || "Cidade não informada");
      const impact = escapeHTML(item.nivelImpacto || "Sem descrição de impacto");
      return '<tr>' +
        '<td data-label="CIDADE / DATA"><div class="city-cell"><span class="city-marker" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z"></path><circle cx="12" cy="10" r="2"></circle></svg></span><span><strong>' + city + '</strong><small>' + escapeHTML(formatDate(item.data)) + '</small></span></div></td>' +
        '<td data-label="TIPO DE EVENTO"><span class="type-badge ' + typeClass(item.tipoEvento) + '"><i></i>' + type + "</span></td>" +
        '<td data-label="TEMP. MÁXIMA"><span class="temperature-value">' + escapeHTML(formatTemperature(item.temperaturaMaxima)) + '</span></td>' +
        '<td data-label="NÍVEL DE IMPACTO"><span class="impact-text">' + impact + '</span></td>' +
        '<td data-label="AÇÕES"><div class="row-actions"><button class="icon-button edit-event" type="button" data-id="' + id + '" aria-label="Editar evento em ' + city + '" title="Editar"><svg viewBox="0 0 24 24"><path d="m14 6 4 4M4 20l4-.8L19 8a2.1 2.1 0 0 0-3-3L5 16l-1 4Z"></path></svg></button><button class="icon-button delete-event" type="button" data-id="' + id + '" aria-label="Excluir evento em ' + city + '" title="Excluir"><svg viewBox="0 0 24 24"><path d="M4 7h16M10 11v6M14 11v6M5.5 7l1 13h11l1-13M9 7V4h6v3"></path></svg></button></div></td>' +
        "</tr>";
    }).join("");
  }

  async function loadEvents() {
    if (!currentUser) return;
    eventRows.innerHTML = "";
    setTableState("Carregando eventos...", "Buscando os registros mais recentes.", false);
    try {
      const result = await api("/evento/listar");
      events = Array.isArray(result) ? result : [];
      renderEvents();
    } catch (error) {
      events = [];
  
      $("#eventCountPill").textContent = "—";
      $("#eventsFooterCount").textContent = "—";
      setTableState("Não foi possível carregar os eventos", "Verifique a conexão com a API e tente novamente.", true);
    }
  }

  function toLocalDateTime(value) {
    const date = value ? new Date(value) : new Date();
    if (Number.isNaN(date.getTime())) return "";
    const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return localDate.toISOString().slice(0, 16);
  }

  function openEventDialog(item) {
    editingEvent = item || null;
    eventForm.reset();
    $("#editingEventId").value = item ? item.id : "";
    $("#eventCity").value = item ? item.cidade || "" : "";
    $("#eventType").value = item ? item.tipoEvento || "" : "";
    $("#eventTemperature").value = item && item.temperaturaMaxima != null ? String(item.temperaturaMaxima) : "";
    $("#eventDate").value = toLocalDateTime(item ? item.data : new Date());
    $("#eventImpact").value = item ? item.nivelImpacto || "" : "";

    $("#dialogTitle").textContent = item ? "Editar evento" : "Adicionar evento";
    $("#saveEventButton").querySelector("span").textContent = item ? "Salvar alterações" : "Salvar evento";
    $("#eventFormMessage").hidden = true;
    eventDialog.showModal();
    window.setTimeout(function () { $("#eventCity").focus(); }, 50);
  }

  function closeEventDialog() {
    eventDialog.close();
    editingEvent = null;
  }

  $("#createEventButton").addEventListener("click", function () { openEventDialog(null); });
  $("#closeDialogButton").addEventListener("click", closeEventDialog);
  $("#cancelDialogButton").addEventListener("click", closeEventDialog);
  eventDialog.addEventListener("click", function (event) {
    if (event.target === eventDialog) closeEventDialog();
  });
  retryEventsButton.addEventListener("click", loadEvents);
  eventSearch.addEventListener("input", renderEvents);
  typeFilter.addEventListener("change", renderEvents);

  eventRows.addEventListener("click", async function (event) {
    const editButton = event.target.closest(".edit-event");
    const deleteButton = event.target.closest(".delete-event");
    if (editButton) {
      const item = events.find(function (entry) { return Number(entry.id) === Number(editButton.dataset.id); });
      if (item) openEventDialog(item);
    }
    if (deleteButton) {
      const item = events.find(function (entry) { return Number(entry.id) === Number(deleteButton.dataset.id); });
      if (!item) return;
      if (!window.confirm("Excluir o evento registrado em " + (item.cidade || "esta cidade") + "?")) return;
      deleteButton.disabled = true;
      try {
        await api("/evento/excluir/" + encodeURIComponent(item.id), { method: "DELETE" });
        await loadEvents();
        showToast("Evento excluído com sucesso.");
      } catch (error) {
        deleteButton.disabled = false;
        showToast("Não foi possível excluir o evento. Tente novamente.", true);
      }
    }
  });

  eventForm.addEventListener("submit", async function (event) {
    event.preventDefault();
    if (!eventForm.reportValidity()) return;
    const button = $("#saveEventButton");
    const message = $("#eventFormMessage");
    const temperature = $("#eventTemperature").value.trim();
    const dateValue = $("#eventDate").value;
    const isEditing = Boolean(editingEvent);
    const payload = {
      cidade: $("#eventCity").value.trim(),
      tipoEvento: $("#eventType").value.trim(),
      temperaturaMaxima: temperature === "" ? null : Number(temperature),
      nivelImpacto: $("#eventImpact").value.trim(),
      usuarioId: isEditing ? editingEvent.usuarioId : currentUser.id
    };
    if (dateValue) payload.data = new Date(dateValue).toISOString();
    button.disabled = true;
    button.querySelector("span").textContent = "Salvando...";
    message.hidden = true;
    try {
      if (isEditing) {
        await api("/evento/atualizar/" + encodeURIComponent(editingEvent.id), { method: "PUT", body: JSON.stringify(payload) });
      } else {
        await api("/evento/cadastrar", { method: "POST", body: JSON.stringify(payload) });
      }
      closeEventDialog();
      await loadEvents();
      showToast(isEditing ? "Alterações salvas com sucesso." : "Evento registrado com sucesso.");
    } catch (error) {
      message.textContent = "Não foi possível salvar o evento. Verifique a conexão e tente novamente.";
      message.hidden = false;
    } finally {
      button.disabled = false;
      button.querySelector("span").textContent = isEditing ? "Salvar alterações" : "Salvar evento";
    }
  });

  function showToast(message, isError) {
    const toast = $("#toast");
    toast.textContent = message;
    toast.classList.toggle("toast-error", Boolean(isError));
    toast.classList.add("toast-visible");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () { toast.classList.remove("toast-visible"); }, 3500);
  }

  restoreSession();
}());



