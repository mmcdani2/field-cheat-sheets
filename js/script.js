function showSection(id) {
  document.getElementById('spray').classList.remove('active');
  document.getElementById('hvac').classList.remove('active');
  document.getElementById(id).classList.add('active');
}
