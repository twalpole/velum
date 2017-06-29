MinionPoller = {
  selectedNodes: [],

  poll: function() {
    this.request();
  },

  stateWeight: function(state) {
    // I guess updates should be 2

    switch (state) {
      case 'failed':
        return 3;
      case 'pending':
        return 1;
      // applied, not_applied
      default:
        return 0;
    }
  },

  sortMinions: function(minions) {
    minions.sort(function(a, b) {
      return MinionPoller.stateWeight(b.highstate)- MinionPoller.stateWeight(a.highstate);
    });
  },

  request: function() {
    $.ajax({
      url: $('.nodes-container').data('url'),
      dataType: "json",
      cache: false,
      success: function(data) {
        var rendered = "";
        var pendingRendered = "";
        var allApplied = true;
        var updateAvailable = false;
        var updateAvailableNodeCount = 0;

        // In discovery, the minions to be rendered are unassigned, while on the
        // dashboard we don't want to render unassigned minions but we still
        // want to account for them.
        var minions = data.assigned_minions || [];
        var unassignedMinions = data.unassigned_minions || [];
        var pendingMinions = data.pending_minions || [];

        // for the dashboard, if we rely on radio, the first time this comes
        // it won't detect that there's a master, so we need to rely on the data
        // itself for counting masters
        if (MinionPoller.renderMode === 'dashboard') {
          MinionPoller.selectedMasters = data.assigned_minions.reduce(function(memo, minion) {
            if (minion.role === 'master') {
              memo.push(minion.id);
            }

            return memo;
          }, []);
        } else {
          MinionPoller.selectedMasters = $("input[name='roles[master][]']:checked").map(function() {
            return parseInt($( this ).val());
          }).get();
        }

        if (MinionPoller.renderMode !== "Dashboard") {
          minions = unassignedMinions;
        } else {
          MinionPoller.sortMinions(minions);
        }

        var renderMethod = 'render' + MinionPoller.renderMode;
        for (i = 0; i < minions.length; i++) {
          rendered += MinionPoller[renderMethod].call(MinionPoller, minions[i]);

          if (minions[i].highstate != "applied") {
            allApplied = false;
          }
          if (minions[i].update_status == 1 || minions[i].update_status == 3) {
            updateAvailable = true;
            updateAvailableNodeCount++;
          }
        }
        $(".nodes-container tbody").html(rendered);

        // Build Pending Nodes display table

        for (i = 0; i < pendingMinions.length; i++) {
          pendingRendered += MinionPoller.renderPendingNodes(pendingMinions[i])
        }
        $(".pending-nodes-container tbody").html(pendingRendered);

        // Show  / Hide the table depending the presence of pending nodes
        if (pendingMinions.length == 0) {
          $(".pending-nodes-container .panel-body").hide()
          $(".pending-nodes-container #accept-all").attr('disabled', true)
        } else {
          $(".pending-nodes-container .panel-body").show()
          $(".pending-nodes-container #accept-all").attr('disabled', false)
        }

        // show/hide panels on discovery page
        $('.discovery-nodes-panel').toggleClass('hide', unassignedMinions.length === 0);
        $('.discovery-empty-panel').toggleClass('hide', unassignedMinions.length > 0);

        MinionPoller.handleAdminUpdate(data.admin || {});

        if (updateAvailable && allApplied) {
          $("#update-all-nodes").attr('disabled', false);
        }

        MinionPoller.enable_kubeconfig(minions.length > 0 && allApplied);

        $('#out_dated_nodes').text(updateAvailableNodeCount)

        $('.assigned-count').text(minions.length);
        $('.master-count').text(MinionPoller.selectedMasters.length);

        var addNodesUrl = $('.unassigned-count').data('url');
        if (unassignedMinions.length > 0) {
          // discovery page uses #node-count,
          // overview page otherwise
          if ($("#node-count").length > 0) {
            $("#node-count").text(unassignedMinions.length + " nodes found");
          } else {
            $('.unassigned-count').html(unassignedMinions.length + ' <a href="' + addNodesUrl + '">(new)</a>');
          }
        } else {
          $('.unassigned-count').text(0);
        }

        // remove loading and shows content
        $('.summary-loading').hide();
        $('.summary-content').removeClass('hidden');
        $('.nodes-loading').hide();
        $('.nodes-content').removeClass('hidden');
      }
    }).always(function() {
      // make another request only after the last one finished
      setTimeout(MinionPoller.request, 5000);
    });
  },

  renderPendingNodes: function(pendingMinion) {
    return "\
      <tr> \
        <td>" + pendingMinion + "</td>\
        <td><a class='accept-minion' href='#' data-minion-id='" + pendingMinion +  "'>Accept Node</a></td>\
      </tr> \
    ";
  },

  handleAdminUpdate: function(admin) {
    var $notification = $('.admin-outdated-notification');

    if (admin.update_status === undefined) {
      return;
    }

    switch (admin.update_status) {
      case 1:
        $notification.removeClass('hidden');
        $notification.removeClass('admin-outdated-notification--failed');
        break;
      case 2:
        $notification.removeClass('hidden');
        $notification.addClass('admin-outdated-notification--failed');
        break;
      default:
        $notification.addClass('hidden');
        break;
    }
  },

  enable_kubeconfig: function(enabled) {
    $("#download-kubeconfig").attr("disabled", !enabled);
  },

  renderDashboard: function(minion) {
    var statusHtml;
    var checked;
    var masterHtml;

    switch(minion.highstate) {
      case "not_applied":
        statusHtml = '<i class="fa fa-circle-o text-success fa-2x" aria-hidden="true"></i>';
        break;
      case "pending":
        statusHtml = '\
          <span class="fa-stack" aria-hidden="true">\
            <i class="fa fa-circle fa-stack-2x text-success" aria-hidden="true"></i>\
            <i class="fa fa-refresh fa-stack-1x fa-spin fa-inverse" aria-hidden="true"></i>\
          </span>';
        break;
      case "failed":
        statusHtml = '<i class="fa fa-times-circle text-danger fa-2x" aria-hidden="true"></i>';
        break;
      case "applied":
        statusHtml = '<i class="fa fa-check-circle-o text-success fa-2x" aria-hidden="true"></i>';
        break;
    }

    if ((MinionPoller.selectedMasters && MinionPoller.selectedMasters.indexOf(minion.id) != -1) || minion.role == "master") {
      checked =  "checked";
    } else {
      checked = '';
    }

    masterHtml = '<input name="roles[master][]" id="roles_master_' + minion.id +
      '" value="' + minion.id + '" type="radio" disabled="" ' + checked + '>';

    statusText = ''

    switch(minion.update_status) {
      case 1:
        switch (minion.highstate) {
          case "applied":
            statusHtml = '<i class="fa fa-arrow-circle-up text-info fa-2x" aria-hidden="true"></i>';
            statusText = 'Update Available'
            break;
          case "failed":
            statusHtml = '<i class="fa fa-arrow-circle-up text-warning fa-2x" aria-hidden="true"></i>';
            statusText = 'Update Failed - Retryable'
            break;
          case "pending":
            statusText = 'Update in progress'
            break;
        }
        break;
      case 2:
        statusHtml = '<i class="fa fa-arrow-circle-up text-danger fa-2x" aria-hidden="true"></i>';
        statusText = 'Update Failed'
        break;
    }

    return "\
      <tr> \
        <td>" + statusHtml +  "</td>\
        <td>" + statusText +  "</td>\
        <th>" + minion.minion_id +  "</th>\
        <td>" + minion.fqdn +  "</td>\
        <td>" + (minion.role || '') +  "</td>\
        <td class='text-center'>" + masterHtml + "</td>\
      </tr>";
  },

  renderDiscovery: function(minion, onlyWorkers) {
    var masterHtml;
    var masterChecked = '';
    var minionHtml;
    var minionChecked = '';

    if (MinionPoller.selectedMasters && MinionPoller.selectedMasters.indexOf(minion.id) != -1) {
      masterChecked = 'checked';
      minionChecked += 'disabled="disabled" checked ';
    }

    if (onlyWorkers) {
      masterHtml = '';
    } else {
      masterHtml = '<td class="text-center">\
        <input name="roles[master][]" id="roles_master_' + minion.id +
        '" value="' + minion.id + '" type="radio" ' + masterChecked + '></td>';
    }

    if (MinionPoller.selectedNodes && MinionPoller.selectedNodes.indexOf(minion.id) != -1) {
      minionChecked += 'checked';
    }

    minionHtml = '<input name="roles[worker][]" id="roles_minion_' + minion.id +
      '" value="' + minion.id + '" type="checkbox" ' + minionChecked + '>';

    return "\
      <tr> \
        <td>" + minionHtml +  "</td>\
        <td>" + minion.minion_id +  "</td>\
        <td>" + minion.fqdn +  "</td>\
        " + masterHtml + "\
      </tr>";
  },

  renderUnassigned: function(minion) {
    return MinionPoller.renderDiscovery(minion, true);
  }
};

$('body').on('click', '.accept-minion', function(e) {
  var $link = $(this);
  var selector = ''
  e.preventDefault();

  if ($link[0].id == "accept-all") {
    selector = '*'
  } else {
    selector = $link.data('minionId')
  }
  $link.prop('disabled', true);

  $.ajax({
    url: '/accept-minion',
    method: 'POST',
    data: {minion_id: selector}
  })
});

$('.update-admin-modal').on('hide.bs.modal', function(e) {
  var isRebooting = $('.update-admin-modal').data('rebooting');

  if (isRebooting) {
    e.preventDefault();
  }
});

// unlock modal, now closable
function unlockUpdateAdminModal() {
  var $modal = $('.update-admin-modal');
  var $btn = $modal.find('.btn');

  $modal.data('rebooting', false);
  $modal.find('.close').show();
  $btn.prop('disabled', false);
}

// lock modal, won't close
function lockUpdateAdminModal() {
  var $modal = $('.update-admin-modal');
  var $btn = $modal.find('.btn');

  $btn.prop('disabled', true);
  $modal.data('rebooting', true);
  $modal.find('.close').hide();
}

// reboot to update admin node handler
$('body').on('click', '.reboot-update-btn', function(e) {
  var REBOOTING = 3;
  var $btn = $(this);
  var $modal = $('.update-admin-modal');

  e.preventDefault();

  $btn.html('<i class="fa fa-spinner fa-pulse fa-fw"></i> Rebooting...');
  lockUpdateAdminModal();

  $.post($btn.data('url'))
  .done(function(data) {
    if (data.status === REBOOTING) {
      setTimeout(healthCheckToReload, 30000);
    } else {
      // update not needed
      unlockUpdateAdminModal();
      $btn.text('Reboot to update');
    }
  })
  .fail(function() {
    unlockUpdateAdminModal();
    $btn.text('Reboot to update (failed last time)');
  });
});

// health check request
// if successful, reload page
// schedule another check otherwise
function healthCheckToReload() {
  var healthCheckUrl = $('.reboot-update-btn').data('healthCheck');

  $.get(healthCheckUrl)
  .success(function() {
    window.location.reload();
  })
  .fail(function() {
    setTimeout(healthCheckToReload, 3000);
  });
};

// enable/disable Add nodes button to assign nodes
function toggleAddNodesButton() {
  var selectedNodes = $("input[name='roles[worker][]']:checked").length;

  $('.add-nodes-btn').prop('disabled', selectedNodes === 0);
};

// unassigned nodes page
$('body').on('change', '.new-nodes-container input[name="roles[worker][]"]', toggleAddNodesButton);

// return true if master is selected
// false otherwise
function isMasterSelected() {
  return $('input[name="roles[master][]"]:checked').length > 0;
}

// return number of selected checkboxes
function selectedNodesLength() {
  return $('input[name="roles[worker][]"]:checked').length;
}

// disable/enable button if it has 1 master and 1 worker at least
function toggleBootstrapButton() {
  var hasMinimumAmountToEnable = isMasterSelected() && selectedNodesLength() > 1;

  $('#bootstrap').prop('disabled', !hasMinimumAmountToEnable);
}

// bootstrap cluster button click listener
// if it has the minimum amount of nodes, form is submitted as expected
// otherwise it shows the modal if didn't show yet
$('body').on('click', '#bootstrap', function(e) {
  var $warningModal = $('.warn-minimum-nodes-modal');
  var hasMinimumAmountToSubmit = isMasterSelected() && selectedNodesLength() > 2;

  if (!hasMinimumAmountToSubmit) {
    e.preventDefault();

    $warningModal.modal('show');
    $warningModal.data('wasOpenedBefore', true);

    return false;
  }
});

// if user wants to bootstrap anyway, submit form
$('body').on('click', '.bootstrap-anyway', function() {
  $('.warn-minimum-nodes-modal').modal('hide');
  $('form').submit();
});

// discovery page
$('body').on('change', '.nodes-container input[name="roles[worker][]"]', toggleBootstrapButton);

// checkbox on the top the checks/unchecks all nodes
$('.check-all').on('change', function() {
  $('input[name="roles[worker][]"]:not(:disabled)').prop('checked', this.checked).change();
  toggleBootstrapButton();
  toggleAddNodesButton();
});

// when checking/unchecking a node
// stores it on MinionPoller.selectedNodes for future rendering
$('body').on('change', 'input[name="roles[worker][]"]', function() {
  var value = parseInt(this.value, 10);

  if (this.checked) {
    MinionPoller.selectedNodes.push(value);
  } else {
    var index = MinionPoller.selectedNodes.indexOf(value);
    MinionPoller.selectedNodes.splice(index, 1);
  }
});

// when selecting a master
// selects node and makes it impossible to uncheck
// enable and keep the previous state of the previous master (selected or not)
// if user select node as master, it checks it as selected
$('body').on('change', 'input[name="roles[master][]"]', function() {
  var $previousMaster = $('input[name="roles[worker][]"]:disabled');
  var previousMasterValue = parseInt($previousMaster.val(), 10);
  var checked = MinionPoller.selectedNodes.indexOf(previousMasterValue) !== -1;

  $previousMaster.prop('disabled', false);
  $previousMaster.prop('checked', checked);

  if (this.checked) {
    var $checkbox = $(this).closest('tr').find('input[name="roles[worker][]"]');

    $checkbox.prop('checked', true);
    $checkbox.prop('disabled', true);
  }

  toggleBootstrapButton();
});
