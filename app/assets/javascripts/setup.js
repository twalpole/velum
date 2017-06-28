$('.btn-group-toggle').click(function() {
  $btnGroup = $(this);
  $btnGroup.find('.btn').toggleClass('active');
  $btnGroup.find('.btn').toggleClass('btn-primary');
  $btnGroup.find('.btn').toggleClass('btn-default');
});
